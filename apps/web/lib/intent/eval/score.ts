import { isOffered } from "@/lib/config/launch-garments";
import { getType } from "@/lib/garment";
import { LATENCY_BUDGET_MS, type EvalCase, type Observation } from "./schema";
import { matchColours } from "./colours";

export interface CaseScore {
  readonly id: string;
  readonly category: string;
  /** Pending cases are scored against what the registry can do today and kept out of the headline. */
  readonly bucket: "headline" | "pending";
  readonly expectedKind: EvalCase["expected"]["kind"];
  readonly correct: boolean;
  /** The reading named an article the registry does not have. Always wrong. */
  readonly invented: boolean;
  /** The reading named an article the beta does not offer yet. Reported, not scored. */
  readonly outsideLaunch: boolean;
  /** Out-of-catalogue cases only. */
  readonly nearestCorrect: boolean | null;
  readonly differenceGiven: boolean | null;
  readonly colour: { expected: number; matched: number; extra: number; exact: boolean } | null;
  readonly latencyMs: number;
  readonly costMicrodollars: number;
  readonly failed: string | null;
}

const named = (observation: Observation): readonly string[] => {
  const { prediction } = observation;
  return prediction.kind === "article" ? [prediction.articleId] : prediction.kind === "ambiguous" ? prediction.candidates : [];
};

function isCorrect(item: EvalCase, observation: Observation): boolean {
  const { expected } = item;
  const { prediction } = observation;
  if (expected.kind === "article") return prediction.kind === "article" && prediction.articleId === expected.articleId;
  if (expected.kind === "out-of-catalogue") return prediction.kind === "decline";
  return prediction.kind === "ambiguous" && prediction.candidates.length >= 2 && prediction.candidates.every((id) => expected.candidates.includes(id));
}

function nearest(item: EvalCase, observation: Observation) {
  if (item.expected.kind !== "out-of-catalogue") return { nearestCorrect: null, differenceGiven: null };
  const said = observation.prediction.kind === "decline" ? observation.prediction.nearest : undefined;
  return {
    nearestCorrect: said !== undefined && said.articleId === item.expected.nearest.articleId,
    differenceGiven: said !== undefined && said.difference.trim() !== "",
  };
}

function colourScore(item: EvalCase, observation: Observation): CaseScore["colour"] {
  if (!item.colours || item.colours.length === 0) return null;
  const { matched, extra } = matchColours(item.colours, observation.colours);
  return { expected: item.colours.length, matched, extra, exact: matched === item.colours.length && extra === 0 };
}

/** Scores one reading. A failed call is wrong and counts for nothing else. */
export function scoreCase(item: EvalCase, observation: Observation): CaseScore {
  const base = {
    id: item.id,
    category: item.category,
    bucket: item.pending_catalogue ? ("pending" as const) : ("headline" as const),
    expectedKind: item.expected.kind,
    latencyMs: observation.latencyMs,
    costMicrodollars: observation.costMicrodollars,
  };
  if (observation.failed !== undefined) {
    return { ...base, correct: false, invented: false, outsideLaunch: false, nearestCorrect: null, differenceGiven: null, colour: null, failed: observation.failed };
  }
  const ids = named(observation);
  const invented = ids.some((id) => getType(id) === undefined);
  return {
    ...base,
    correct: !invented && isCorrect(item, observation),
    invented,
    outsideLaunch: ids.some((id) => getType(id) !== undefined && !isOffered(id)),
    ...nearest(item, observation),
    colour: colourScore(item, observation),
    failed: null,
  };
}

const ratio = (part: number, whole: number): number => (whole === 0 ? 0 : part / whole);

function percentile(sorted: readonly number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)];
}

export function summarise(scores: readonly CaseScore[]) {
  const headline = scores.filter((score) => score.bucket === "headline");
  const pending = scores.filter((score) => score.bucket === "pending");
  const correct = (list: readonly CaseScore[]) => list.filter((score) => score.correct).length;
  const byCategory: Record<string, { n: number; correct: number }> = {};
  for (const score of scores) {
    const entry = byCategory[score.category] ?? { n: 0, correct: 0 };
    byCategory[score.category] = { n: entry.n + 1, correct: entry.correct + (score.correct ? 1 : 0) };
  }
  const outside = headline.filter((score) => score.expectedKind === "out-of-catalogue");
  const withColour = scores.flatMap((score) => (score.colour ? [score.colour] : []));
  const expectedColours = withColour.reduce((sum, c) => sum + c.expected, 0);
  const latencies = scores.map((score) => score.latencyMs).sort((x, y) => x - y);
  const total = scores.reduce((sum, score) => sum + score.costMicrodollars, 0);
  return {
    headline: { n: headline.length, correct: correct(headline), accuracy: ratio(correct(headline), headline.length) },
    pending: { n: pending.length, correct: correct(pending) },
    byCategory,
    outOfCatalogue: {
      n: outside.length,
      declined: correct(outside),
      nearestCorrect: outside.filter((score) => score.nearestCorrect === true).length,
      differenceGiven: outside.filter((score) => score.differenceGiven === true).length,
    },
    colour: {
      cases: withColour.length,
      recall: ratio(withColour.reduce((sum, c) => sum + c.matched, 0), expectedColours),
      exactSets: withColour.filter((c) => c.exact).length,
      extraColours: withColour.reduce((sum, c) => sum + c.extra, 0),
    },
    invented: scores.filter((score) => score.invented).length,
    outsideLaunch: scores.filter((score) => score.outsideLaunch).length,
    failed: scores.filter((score) => score.failed !== null).length,
    latency: {
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      max: latencies.at(-1) ?? 0,
      over10s: latencies.filter((ms) => ms > LATENCY_BUDGET_MS).length,
    },
    cost: { totalMicrodollars: total, perRequestMicrodollars: ratio(total, scores.length) },
  };
}

export type Summary = ReturnType<typeof summarise>;
