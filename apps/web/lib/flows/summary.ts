import { assetLabel, type BoardKind, type Graph } from "@/lib/launch";
import { carriesGenerated } from "./artwork";
import type { FlowEstimate } from "./cost";
import type { FlowRunLine, FlowRunReport } from "./run";
import { FLOW_FORMATS, FLOW_GAP_RULE, type FlowBoardState, type FlowFormat, type FlowRunState } from "./types";

/**
 * The run summary (spec F-L4: "a side panel lists every output, its status and cost"), which is the
 * `flow-run` panel of L1's contract.
 *
 * It has three states and all three are real screens, not one screen with holes in it:
 *
 *   * **nothing run yet** -- the estimate, so the cost is on screen before a credit is spent, and
 *     one named action: Run all;
 *   * **running** -- a line per board with its own status, because a run takes time and a frozen
 *     canvas tells a person nothing;
 *   * **finished** -- every output, what it cost after refunds, what failed and what to do about it,
 *     and Export all.
 */

export interface SummaryRow {
  readonly boardId: string;
  readonly name: string;
  readonly kind: BoardKind;
  readonly state: FlowBoardState;
  readonly format: FlowFormat;
  readonly assets: number;
  readonly credits: number;
  readonly refunded: number;
  readonly fileId: string | null;
  /** What went wrong and what to do, or null. */
  readonly reason: string | null;
  /** "AI-generated" where a model made or touched the picture, as the spec requires. */
  readonly label: string | null;
  readonly ruleId: string;
}

export interface SummaryTotals {
  readonly assets: number;
  readonly ready: number;
  readonly failed: number;
  readonly skipped: number;
  /** Credits the run spent after every refund. The only figure that is real money. */
  readonly spent: number;
  readonly refunded: number;
}

export interface FlowSummary {
  readonly state: FlowRunState | null;
  readonly rows: readonly SummaryRow[];
  readonly totals: SummaryTotals;
  /** How many outputs there are of each format, which is what the zip's folders will hold. */
  readonly byFormat: readonly Readonly<{ format: FlowFormat; count: number }>[];
  /** True when there is at least one finished output to put in a zip. */
  readonly canExport: boolean;
  /** The one thing to do when there is nothing on the panel yet. */
  readonly empty: Readonly<{ title: string; body: string; action: string; ruleId: string }> | null;
  readonly note: string;
}

const EMPTY_NOT_RUN = {
  title: "Nothing has been run yet",
  body: "A flow makes every output in one go, in the order the connectors set. The cost is shown here before anything is spent, and a board that fails gives its credits back.",
  action: "Run all",
  ruleId: FLOW_GAP_RULE,
} as const;

const EMPTY_NO_BOARDS = {
  title: "Nothing to run on this canvas",
  body: "Add a Design board and a mockup, a picture, a post or an info card after it. A board with nothing feeding it has nothing to make.",
  action: "Add a Design board",
  ruleId: FLOW_GAP_RULE,
} as const;

const labelFor = (graph: Graph, boardId: string, state: FlowBoardState): string | null => {
  if (state !== "ready") return null;
  const board = graph.boards.find((one) => one.id === boardId);
  if (!board) return null;
  // A board a model drew, or one whose picture came through such a board, says so on the summary.
  if (!carriesGenerated(graph, boardId)) return null;
  return assetLabel({ role: "scene", provenance: "generated", file: { fileId: "", contentType: "" }, label: "AI-generated", showsPerson: board.settings["showsPerson"] === true });
};

const rowOf = (graph: Graph, line: FlowRunLine): SummaryRow => ({
  boardId: line.boardId,
  name: line.name,
  kind: line.kind,
  state: line.state,
  format: line.format,
  assets: line.assets,
  credits: line.credits,
  refunded: line.refunded,
  fileId: line.fileId,
  reason: line.reason,
  label: labelFor(graph, line.boardId, line.state),
  ruleId: line.ruleId,
});

const totalsOf = (rows: readonly SummaryRow[]): SummaryTotals => ({
  assets: rows.filter((row) => row.state === "ready").reduce((total, row) => total + row.assets, 0),
  ready: rows.filter((row) => row.state === "ready").length,
  failed: rows.filter((row) => row.state === "failed").length,
  skipped: rows.filter((row) => row.state === "skipped").length,
  spent: rows.reduce((total, row) => total + row.credits, 0),
  refunded: rows.reduce((total, row) => total + row.refunded, 0),
});

const formatsOf = (rows: readonly SummaryRow[]): readonly Readonly<{ format: FlowFormat; count: number }>[] =>
  FLOW_FORMATS.map((format) => ({ format, count: rows.filter((row) => row.state === "ready" && row.format === format).length })).filter(
    (one) => one.count > 0,
  );

/** The panel before a run: what it will make, what it will cost, and one action. */
export function estimateSummary(estimate: FlowEstimate): FlowSummary {
  const rows: readonly SummaryRow[] = estimate.lines.map((line) => ({
    boardId: line.boardId,
    name: line.name,
    kind: line.kind,
    state: line.blocked === null ? "queued" : "skipped",
    format: line.format,
    assets: line.assets,
    credits: line.credits,
    refunded: 0,
    fileId: null,
    reason: line.blocked,
    label: null,
    ruleId: line.ruleId,
  }));
  return {
    state: null,
    rows,
    totals: { ...totalsOf(rows), assets: estimate.assets, spent: 0 },
    byFormat: [],
    canExport: false,
    empty: rows.length === 0 ? EMPTY_NO_BOARDS : EMPTY_NOT_RUN,
    note: estimate.note,
  };
}

/** The panel during and after a run: a line per board, with what it cost after refunds. */
export function runSummary(graph: Graph, report: FlowRunReport): FlowSummary {
  const rows = report.lines.map((line) => rowOf(graph, line));
  return {
    state: report.state,
    rows,
    totals: totalsOf(rows),
    byFormat: formatsOf(rows),
    canExport: rows.some((row) => row.state === "ready" && row.fileId !== null),
    empty: rows.length === 0 ? EMPTY_NO_BOARDS : null,
    note: report.estimate.note,
  };
}

/** One sentence under the heading: what came out, what it cost, and what did not finish. */
export function summaryLine(summary: FlowSummary): string {
  const { totals } = summary;
  if (summary.state === null) {
    return `${totals.assets} ${totals.assets === 1 ? "asset" : "assets"} to make. Nothing has been spent yet.`;
  }
  const made = `${totals.assets} ${totals.assets === 1 ? "asset" : "assets"} ready`;
  const money = totals.spent === 0 ? "nothing was charged" : `${totals.spent} credits spent`;
  const back = totals.refunded === 0 ? "" : `, ${totals.refunded} given back`;
  const lost = totals.failed + totals.skipped === 0 ? "" : `, ${totals.failed + totals.skipped} did not finish`;
  return `${made}, ${money}${back}${lost}.`;
}
