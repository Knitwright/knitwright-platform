import { BudgetExhausted } from "./live";
import { scoreCase, summarise, type CaseScore, type Summary } from "./score";
import type { EvalCase, Observer } from "./schema";

export interface EvalRun {
  readonly scores: readonly CaseScore[];
  readonly summary: Summary;
  /** Ids not read because the cost cap was reached. They are in no number above. */
  readonly skipped: readonly string[];
}

/**
 * Reads every case in order and scores it. A reader that throws `BudgetExhausted` ends the run
 * and the rest are listed as skipped; any other error fails that case only.
 */
export async function runEvaluation(cases: readonly EvalCase[], observe: Observer): Promise<EvalRun> {
  const scores: CaseScore[] = [];
  const skipped: string[] = [];
  let stopped = false;
  for (const item of cases) {
    if (stopped) {
      skipped.push(item.id);
      continue;
    }
    try {
      scores.push(scoreCase(item, await observe(item.prompt)));
    } catch (error) {
      if (error instanceof BudgetExhausted) {
        stopped = true;
        skipped.push(item.id);
      } else {
        const message = error instanceof Error ? error.message : "The call failed.";
        scores.push(scoreCase(item, { prediction: { kind: "decline" }, colours: [], latencyMs: 0, costMicrodollars: 0, failed: message }));
      }
    }
  }
  return { scores, summary: summarise(scores), skipped };
}
