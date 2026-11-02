import { isGeneratedKind, runnable, type BoardKind, type BoardView, type Graph, type LaunchCostSource } from "@/lib/launch";
import { runnableIds, type ScopeInput } from "./topology";
import { FLOW_FORMATS, FLOW_GAP_RULE, GENERATIONS, type FlowFormat, type Generation } from "./types";

/**
 * What a run costs, said before anything is spent (spec F-L4, and the platform's rule that money is
 * honest).
 *
 * L1 prices a board by its kind: every generated board costs the credit price for marketing media
 * and every other board is free. A flow needs two things that rule does not give:
 *
 *   * **a Mockup board can cost credits.** The spec's own board table says "free if deterministic,
 *     credits if AI scene", and three of the Club kit pack's nine mockups are the teamwear scenes
 *     F-L1 lists as model scenes. Pricing them at nothing would be a lie about money on the one
 *     screen that promises not to tell one.
 *   * **a clip is priced per second** by the model the person picks (F-L3). That list is L5's, so
 *     the figure comes in through `FlowCostSource`; until one is configured a clip is priced as one
 *     generated board and the note says so.
 *
 * NO NUMBER IS WRITTEN DOWN HERE. The figures come from the platform's own credit prices through
 * `LaunchCostSource`, which carries the credits page's placeholder notice with it.
 */

export interface FlowCostSource extends LaunchCostSource {
  /**
   * Credits one second of a clip costs, or null while no model list is configured (L5). Null is not
   * "free": a clip is then priced as one generated board, and the note says the figure is a stand-in.
   */
  readonly perVideoSecond: number | null;
}

/** A cost source with no per-second price, for a shell that only has L1's figure. */
export const flowCostSource = (source: LaunchCostSource, perVideoSecond: number | null = null): FlowCostSource => ({
  ...source,
  perVideoSecond,
});

const number = (value: unknown, fallback: number): number => (typeof value === "number" && Number.isFinite(value) ? value : fallback);

/**
 * How a board's picture is made. A board a flow template made says so in its own settings; a board
 * somebody drew by hand is read from its kind, which is what L1 does.
 */
export function boardGeneration(board: BoardView): Generation {
  const written = board.settings["generation"];
  if (typeof written === "string" && (GENERATIONS as readonly string[]).includes(written)) return written as Generation;
  return isGeneratedKind(board.kind) ? "model" : "deterministic";
}

/** The format a board's output comes out as, for the zip's folders. */
export function boardFormat(board: BoardView): FlowFormat {
  const written = board.settings["format"];
  if (typeof written === "string" && (FLOW_FORMATS as readonly string[]).includes(written)) return written as FlowFormat;
  return board.kind === "ai_video" ? "mp4" : "png";
}

/** How many finished assets a board's output counts as. One, unless the board says otherwise. */
export const boardAssets = (board: BoardView): number => Math.max(0, Math.round(number(board.settings["assets"], 1)));

/** What one board costs to run now. A board the platform draws itself is free and says so. */
export function flowBoardCost(board: BoardView, source: FlowCostSource): number {
  if (boardGeneration(board) === "deterministic") return 0;
  if (board.kind === "ai_video" && source.perVideoSecond !== null) {
    return Math.max(0, Math.round(source.perVideoSecond * number(board.settings["seconds"], 1)));
  }
  const count = Math.max(1, Math.round(number(board.settings["count"], 1)));
  return Math.max(0, Math.round(source.perGeneratedBoard) * count);
}

export interface FlowCostLine {
  readonly boardId: string;
  readonly kind: BoardKind;
  readonly name: string;
  readonly generation: Generation;
  readonly format: FlowFormat;
  readonly assets: number;
  readonly credits: number;
  /** Why this board cannot run, or null. A board that cannot run is never charged for. */
  readonly blocked: string | null;
  readonly ruleId: string;
}

export interface FlowEstimate {
  readonly lines: readonly FlowCostLine[];
  /** The credits the boards that can run would spend. A blocked board adds nothing. */
  readonly credits: number;
  /** How many assets the run would make, for "14 assets" on the button's own line. */
  readonly assets: number;
  /** How many of the boards asked for cannot run as the canvas stands. */
  readonly blocked: number;
  readonly note: string;
  readonly ruleId: string;
}

/**
 * The estimate for a press of Regenerate, Run all downstream or Run all. Shown before the run, on
 * the button and in the run panel, and nothing is spent until the person presses it again.
 */
export function estimateFlow(graph: Graph, input: ScopeInput, source: FlowCostSource): FlowEstimate {
  const lines = runnableIds(graph, input).flatMap((id): readonly FlowCostLine[] => {
    const board = graph.boards.find((one) => one.id === id);
    if (!board) return [];
    const verdict = runnable(graph, id);
    const blocked = verdict.canRun ? null : verdict.reason;
    return [
      {
        boardId: id,
        kind: board.kind,
        name: board.name,
        generation: boardGeneration(board),
        format: boardFormat(board),
        assets: boardAssets(board),
        credits: blocked ? 0 : flowBoardCost(board, source),
        blocked,
        ruleId: board.ruleId || FLOW_GAP_RULE,
      },
    ];
  });
  return {
    lines,
    credits: lines.reduce((total, line) => total + line.credits, 0),
    assets: lines.reduce((total, line) => total + (line.blocked ? 0 : line.assets), 0),
    blocked: lines.filter((line) => line.blocked !== null).length,
    note: source.perVideoSecond === null && lines.some((line) => line.kind === "ai_video")
      ? `${source.note} No per-second price is set for a clip yet, so a clip is counted as one generated picture.`
      : source.note,
    ruleId: source.ruleId,
  };
}

/** The words on a Run button: what it makes, and what it costs before anything is spent. */
export function flowRunLabel(estimate: FlowEstimate): string {
  if (estimate.lines.length === 0) return "Nothing to run";
  if (estimate.lines.every((line) => line.blocked !== null)) return "Nothing can run yet";
  const assets = `${estimate.assets} ${estimate.assets === 1 ? "asset" : "assets"}`;
  return estimate.credits === 0 ? `Run all (${assets}, free)` : `Run all (${assets}, ${estimate.credits} credits)`;
}
