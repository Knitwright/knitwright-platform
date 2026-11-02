import { BOARDS, LAUNCH_GAP_RULE, type BoardKind } from "./boards";
import { runnable, runOrder, type Graph } from "./graph";

/**
 * What a run costs, and whether the brand can afford it (spec F-L4: "Run all ▶ 120 credits", and
 * the rule that every Generate button shows its cost before anything is spent).
 *
 * **No number here is a literal.** The cost of a generated board is read from the platform's own
 * credit prices (`lib/credits/settings.ts`, the `credits.price_marketing_media` setting a platform
 * admin can change), and the shell carries the note that says those prices are placeholders the
 * owner has not set. A deterministic board is free, which is the spec's own table rather than a
 * price.
 *
 * Per-model and per-second costs are not here either: an AI video is priced per second by the model
 * the person picks, and that list is L5's, configured in admin. The shell asks a `LaunchCostSource`
 * for the figure and shows what it is told, so when L3 and L5 land their model lists the shell
 * needs no change.
 */

export interface LaunchCostSource {
  /** Credits one generated picture or clip costs, before any per-model or per-second figure. */
  readonly perGeneratedBoard: number;
  /** Where the figure came from, shown beside every cost. Never a sentence this file invented. */
  readonly note: string;
  readonly ruleId: string;
}

/** What one board costs to run now. A free board costs nothing, and says so rather than showing "0". */
export function boardCost(kind: BoardKind, source: LaunchCostSource): number {
  return BOARDS[kind].paid ? Math.max(0, Math.round(source.perGeneratedBoard)) : 0;
}

export interface RunLine {
  readonly boardId: string;
  readonly kind: BoardKind;
  readonly credits: number;
  /** Why this board cannot run, or null. A board that cannot run is never charged for. */
  readonly blocked: string | null;
}

export interface RunEstimate {
  readonly lines: readonly RunLine[];
  /** The credits the boards that can run would spend. A blocked board adds nothing. */
  readonly credits: number;
  readonly note: string;
  readonly ruleId: string;
}

/** The estimate for one board and, when asked, every board it feeds (spec "Run all downstream"). */
export function estimateRun(graph: Graph, boardId: string, source: LaunchCostSource, downstream = false): RunEstimate {
  const ids = downstream ? [boardId, ...runOrder(graph, boardId)] : [boardId];
  const lines = ids.flatMap((id): readonly RunLine[] => {
    const board = graph.boards.find((one) => one.id === id);
    if (!board) return [];
    const verdict = runnable(graph, id);
    const blocked = verdict.canRun ? null : verdict.reason;
    return [{ boardId: id, kind: board.kind, credits: blocked ? 0 : boardCost(board.kind, source), blocked }];
  });
  return {
    lines,
    credits: lines.reduce((total, line) => total + line.credits, 0),
    note: source.note,
    ruleId: source.ruleId,
  };
}

export type AffordVerdict =
  | Readonly<{ affordable: true; credits: number }>
  | Readonly<{ affordable: false; reason: string; ruleId: string }>;

/**
 * Whether the brand's balance covers the estimate. A balance the shell could not read is not
 * treated as nothing: it refuses with a message that says the balance is unknown, because
 * charging against a balance nobody read is worse than asking again.
 */
export function affordable(estimate: RunEstimate, balance: number | null): AffordVerdict {
  if (estimate.credits === 0) return { affordable: true, credits: 0 };
  if (balance === null) {
    return { affordable: false, reason: "Your credit balance could not be read just now. Open the credits page and try again.", ruleId: LAUNCH_GAP_RULE };
  }
  if (balance < estimate.credits) {
    return { affordable: false, reason: `This run costs ${estimate.credits} credits and you have ${balance}.`, ruleId: LAUNCH_GAP_RULE };
  }
  return { affordable: true, credits: estimate.credits };
}

/** The words on a Run button: free, or the credits it costs. */
export function runLabel(estimate: RunEstimate): string {
  if (estimate.lines.every((line) => line.blocked !== null)) return "Nothing to run";
  if (estimate.credits === 0) return "Run (free)";
  return `Run (${estimate.credits} credits)`;
}
