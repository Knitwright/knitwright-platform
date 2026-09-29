import { spentMicrodollars, type ModelEntry, type ModelId } from "@/lib/providers/catalog";
import type { TextModelProvider } from "@/lib/providers/text-model";
import { rejection } from "../outcome";
import { runTextIntent } from "../text-flow";
import { ruleReply } from "../rules";
import { scoreCase, startSpec, summarise, type CaseScore, type GoldenCase, type RecordedReply } from "./replay";

/**
 * The live evaluation (plan step 12, tasks 2 and 6). Each golden case is run the way the
 * product runs it: guard, rules, then the model. Replies are recorded in the replay shape,
 * so the run can be replayed in CI afterwards without a model. No run has been made yet:
 * provider keys are owed (owner action A3). See docs/evals/README.md.
 */

export interface EvalReport {
  readonly model: string;
  readonly date: string;
  readonly summary: ReturnType<typeof summarise>;
  /** Correct outcomes over all cases. */
  readonly accuracy: number;
  readonly answeredByRules: number;
  /** Cases whose model call failed. They count as wrong. */
  readonly failures: readonly string[];
  readonly costMicrodollars: number;
  readonly costPerRequestMicrodollars: number;
  readonly scores: readonly CaseScore[];
  /** The replies, in the shape `recordingSchema` reads, for replay in CI. */
  readonly recording: {
    readonly synthetic: false;
    readonly source: string;
    readonly responses: Record<string, RecordedReply>;
    readonly faults: readonly never[];
  };
}

/** Wraps a provider so the text of every reply is kept. */
function recording(provider: TextModelProvider): { provider: TextModelProvider; last: () => string | undefined; reset: () => void } {
  let last: string | undefined;
  return {
    provider: {
      provider: provider.provider,
      model: provider.model,
      complete: async (request) => {
        const reply = await provider.complete(request);
        last = reply.text;
        return reply;
      },
    },
    last: () => last,
    reset: () => {
      last = undefined;
    },
  };
}

export async function evaluateText({
  cases,
  provider,
  entry,
  date,
}: {
  readonly cases: readonly GoldenCase[];
  readonly provider: TextModelProvider;
  readonly entry: ModelEntry;
  readonly date: string;
}): Promise<EvalReport> {
  const recorder = recording(provider);
  const scores: CaseScore[] = [];
  const responses: Record<string, RecordedReply> = {};
  const failures: string[] = [];
  let cost = 0;
  let byRules = 0;
  for (const golden of cases) {
    recorder.reset();
    const spec = startSpec(golden.start);
    try {
      const result = await runTextIntent({ utterance: golden.utterance, spec }, { primary: recorder.provider, retry: null });
      if (result.answeredBy === "rules") {
        byRules += 1;
        responses[golden.id] = ruleReply(golden.utterance);
      }
      for (const call of result.calls) cost += spentMicrodollars(entry, call.usage);
      const said = recorder.last();
      if (said !== undefined) responses[golden.id] = said;
      scores.push(scoreCase(golden, result.outcome));
    } catch {
      failures.push(golden.id);
      scores.push(scoreCase(golden, rejection("The call failed.")));
    }
  }
  const summary = summarise(scores);
  return {
    model: provider.model,
    date,
    summary,
    accuracy: cases.length === 0 ? 0 : summary.correct / cases.length,
    answeredByRules: byRules,
    failures,
    costMicrodollars: cost,
    costPerRequestMicrodollars: cases.length === 0 ? 0 : cost / cases.length,
    scores,
    recording: { synthetic: false, source: `Recorded from ${provider.model} on ${date} by the live evaluation.`, responses, faults: [] },
  };
}

/**
 * The cheapest model that meets the target (plan cost rule 3). Candidates are tried in the
 * order given, cheapest first, and the first to meet it wins. Every run is kept for the record.
 */
export async function selectModel(
  candidates: readonly ModelId[],
  target: number,
  run: (id: ModelId) => Promise<EvalReport>,
): Promise<{ chosen: ModelId | null; reports: EvalReport[] }> {
  const reports: EvalReport[] = [];
  for (const id of candidates) {
    const report = await run(id);
    reports.push(report);
    if (report.accuracy >= target) return { chosen: id, reports };
  }
  return { chosen: null, reports };
}
