import type { UsageMeter } from "@/lib/usage/meter";
import type { KitCandidate } from "./engine";

/**
 * The ONE thing a model is allowed to do in crest-to-kit: put the kits in an order and write one
 * line about each (spec F-T2 step 5, spec decision 13, "AI never draws the garment").
 *
 * The seam is built so that it CANNOT do anything else, rather than merely not being asked to. A
 * ranker is handed descriptions — an id, the words of the role and the family, and the catalogue
 * codes — and hands back ids and lines. `applyRanking` then takes every value of the kit from the
 * candidate the id names, so an answer that carries a colour, a code, a placement or a whole kit of
 * its own is dropped on the floor: there is no field on the way back for it to land in.
 *
 * The line itself is checked too. A line holding a colour value, a measurement or a catalogue code
 * is refused and Knitwright's own line is kept, because a model must not state a value about the
 * garment even in prose. `rank.test.ts` proves each of these with a ranker that tries.
 *
 * NOTHING HERE CALLS ANYTHING. The only implementation that ships is `knitwrightRanking`, which is
 * arithmetic over the candidates. A real model goes behind `meteredRanker`, which reserves the cost
 * before the call and gives it back when the call fails, like every other paid call in the codebase.
 */

/** What a ranker is told about one kit: words and codes, and never a picture or a pattern file. */
export interface RankCard {
  readonly id: string;
  readonly roleLabel: string;
  readonly familyLabel: string;
  /** The catalogue codes of the kit, as the configurator shows them. */
  readonly codes: readonly string[];
}

export interface RankRequest {
  readonly clubName: string | null;
  readonly sportId: string;
  readonly feel: string;
  readonly cards: readonly RankCard[];
}

/** What a ranker hands back: an id it was given, and one line. Anything else is ignored. */
export interface RankedEntry {
  readonly id: string;
  readonly line: string;
}

export interface KitRanker {
  readonly name: string;
  rank(request: RankRequest, signal?: AbortSignal): Promise<readonly RankedEntry[]>;
}

/** The longest line a card shows. A line over it is refused, not cut: a cut line can change meaning. */
export const MAX_LINE_LENGTH = 120;

/** A colour value, a measurement, or a catalogue code: things only Knitwright's own data may state. */
const FORBIDDEN_IN_LINE = /#[0-9a-f]{3,8}|\b[0-9]+(\.[0-9]+)?\s?(mm|cm|dpi|%)\b|\b[A-Z][0-9]{2}\b|\brgb\(|\bpantone\b/i;

/** Control characters and the marks that change the direction of text. */
const NOT_KEPT = /[\p{Cc}\p{Cf}\p{Cs}]/gu;

/**
 * A line a card may show, or null when the answer may not be shown. A refused line is not repaired:
 * the candidate keeps the line Knitwright wrote, which is always there.
 */
export function safeLine(line: string): string | null {
  const plain = line.replace(NOT_KEPT, "").trim().replace(/\s+/g, " ");
  if (plain === "" || plain.length > MAX_LINE_LENGTH) return null;
  return FORBIDDEN_IN_LINE.test(plain) ? null : plain;
}

/** The descriptions handed to a ranker. The kit itself never leaves this process. */
export const cardsOf = (candidates: readonly KitCandidate[]): readonly RankCard[] =>
  candidates.map((candidate) => ({
    id: candidate.id,
    roleLabel: candidate.roleLabel,
    familyLabel: candidate.familyLabel,
    codes: Object.values(candidate.choice.codes),
  }));

/**
 * The candidates in the order a ranker asked for, each with its own line where the ranker's line
 * may be shown. Every other value is taken from the candidate: the ranker cannot change one.
 *
 * An id the ranker invented is ignored. A candidate the ranker did not mention keeps its place at
 * the end, in the engine's own order, so a short or empty answer still shows every kit.
 */
export function applyRanking(candidates: readonly KitCandidate[], ranked: readonly RankedEntry[]): readonly KitCandidate[] {
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate] as const));
  const lines = new Map<string, string>();
  const order: KitCandidate[] = [];
  for (const entry of ranked) {
    const candidate = byId.get(entry.id);
    if (candidate === undefined || lines.has(entry.id)) continue;
    const line = safeLine(entry.line);
    lines.set(entry.id, line ?? candidate.note);
    order.push(candidate);
  }
  const rest = candidates.filter((candidate) => !lines.has(candidate.id));
  return [...order, ...rest].map((candidate) => ({ ...candidate, note: lines.get(candidate.id) ?? candidate.note }));
}

/**
 * The order Knitwright itself puts the kits in, with no model involved: the kits whose body colour
 * sits nearest the crest's dominant colour first, then by id, so the same crest gives the same
 * cards in the same order every run. This is what ships, and what a failed ranker falls back to.
 */
export function rankByFit(candidates: readonly KitCandidate[]): readonly KitCandidate[] {
  const drift = (candidate: KitCandidate): number => candidate.primaryDeltaE00 ?? Number.POSITIVE_INFINITY;
  return [...candidates].sort((a, b) => drift(a) - drift(b) || a.id.localeCompare(b.id));
}

/** A ranker for tests: the ids and lines given, whatever is asked. It reaches no network. */
export const fixedRanking = (entries: readonly RankedEntry[]): KitRanker => ({
  name: "fixed",
  rank: () => Promise.resolve(entries),
});

/** Said where a ranker could not be reached. The cards are still shown, in Knitwright's own order. */
export const RANKING_UNAVAILABLE = "The kits below are in Knitwright's own order: no model was asked.";

export type RankingOutcome = Readonly<{ candidates: readonly KitCandidate[]; note: string | null }>;

/**
 * The kits as they are shown: a ranker's order when one answers, Knitwright's own when none does.
 * A ranker that throws, or that answers with nothing, never costs the club its kits.
 */
export async function rankedKits(
  candidates: readonly KitCandidate[],
  ranker: KitRanker | null,
  request: Omit<RankRequest, "cards">,
  signal?: AbortSignal,
): Promise<RankingOutcome> {
  const own = rankByFit(candidates);
  if (ranker === null) return { candidates: own, note: RANKING_UNAVAILABLE };
  try {
    const ranked = await ranker.rank({ ...request, cards: cardsOf(own) }, signal);
    return ranked.length === 0 ? { candidates: own, note: RANKING_UNAVAILABLE } : { candidates: applyRanking(own, ranked), note: null };
  } catch {
    return { candidates: own, note: RANKING_UNAVAILABLE };
  }
}

type Who = Readonly<{ brandId: string; userId: string }>;

export const ALLOWANCE_USED_UP = "The AI allowance is used up, so the kits are in Knitwright's own order.";

/**
 * A ranker that pays through the usage meter, as every paid call in the codebase does: the cost is
 * reserved before the call against the person and brand who asked, and given back when it fails.
 * No model ships behind this yet; the wrapper exists so that none can be added without metering.
 */
export function meteredRanker(ranker: KitRanker, meter: UsageMeter, who: Who, cost: number, route: string): KitRanker {
  return {
    name: ranker.name,
    async rank(request, signal) {
      const reservation = await meter.reserve({ userId: who.userId, brandId: who.brandId, cost: { feature: "ai", microdollars: cost }, route });
      if (!reservation.ok) throw new Error(ALLOWANCE_USED_UP);
      try {
        return await ranker.rank(request, signal);
      } catch (error) {
        await meter.refund(reservation.eventId).catch(() => false);
        throw error;
      }
    },
  };
}
