import type { EvalRun } from "./run";
import { ARTICLE_TARGET, LATENCY_BUDGET_MS } from "./schema";

const percent = (value: number): string => `${(value * 100).toFixed(1)}%`;

/** The run as plain text for a terminal or a document. Latency is the only part that changes between runs of the baseline. */
export function formatReport(label: string, run: EvalRun): string {
  const s = run.summary;
  const lines = [
    `Intake evaluation: ${label}`,
    "",
    `Article accuracy: ${s.headline.correct} of ${s.headline.n} (${percent(s.headline.accuracy)}). Target ${Math.round(ARTICLE_TARGET * 100)}%.`,
    `Pending catalogue: ${s.pending.n} prompts need articles that are not merged yet; ${s.pending.correct} are right against today's registry. Not in the number above.`,
    `Invented articles: ${s.invented}. Articles outside the beta list: ${s.outsideLaunch}. Failed calls: ${s.failed}.`,
    `Out of catalogue (${s.outOfCatalogue.n}): left alone ${s.outOfCatalogue.declined}, nearest block right ${s.outOfCatalogue.nearestCorrect}, difference stated ${s.outOfCatalogue.differenceGiven}.`,
    `Colours (${s.colour.cases} prompts): found ${percent(s.colour.recall)} of the named colours, whole set right ${s.colour.exactSets}, extra colours ${s.colour.extraColours}.`,
    `Latency: median ${s.latency.p50.toFixed(1)} ms, 95th ${s.latency.p95.toFixed(1)} ms, longest ${s.latency.max.toFixed(1)} ms, over ${LATENCY_BUDGET_MS / 1000} s: ${s.latency.over10s}.`,
    `Cost: ${s.cost.totalMicrodollars} microdollars in all, ${s.cost.perRequestMicrodollars.toFixed(1)} a prompt.`,
    "",
    "By category:",
    ...Object.entries(s.byCategory)
      .sort(([x], [y]) => x.localeCompare(y))
      .map(([name, c]) => `  ${name}: ${c.correct} of ${c.n}`),
  ];
  if (run.skipped.length > 0) lines.push("", `Skipped, cost cap reached (${run.skipped.length}): ${run.skipped.join(", ")}. These are in no number above.`);
  return `${lines.join("\n")}\n`;
}
