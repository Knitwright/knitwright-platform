import { BOARDS, inputsOf, outputsOf, runOrder, type Graph } from "@/lib/launch";
import type { FlowScope } from "./types";

/**
 * The order a flow runs in (spec F-L4: "Run all downstream", topological).
 *
 * L1 already answers "what does this board feed, in order?" (`runOrder`). Two things it does not
 * answer, and a flow needs both:
 *
 *   * **the whole canvas**, for the Run all button of a flow template, which starts from no
 *     particular board. `topologicalOrder` is a plain Kahn pass over every board, so a board fed by
 *     two others always comes after both of them -- fan-in included.
 *   * **what a failure takes with it.** A board whose own input never finished has nothing to run
 *     from, so it is skipped rather than run and charged for. `dependentsOf` is that set.
 *
 * A Design board and an Artboard are not run: they hold what the person put in them. They are in
 * the order, because the boards that follow them depend on them, and `runnableIds` leaves them out.
 */

/** True when running this kind of board means anything at all. */
const isRunnable = (graph: Graph, boardId: string): boolean => {
  const board = graph.boards.find((one) => one.id === boardId);
  return board !== undefined && BOARDS[board.kind].maxInputs > 0;
};

/**
 * Every board, in an order where a board always comes after the boards that feed it. The canvas has
 * no loops (L1 refuses them), so the order always exists; a board left over after the pass -- which
 * only a loop written straight into the database could cause -- is put at the end rather than lost.
 */
export function topologicalOrder(graph: Graph): readonly string[] {
  const ids = graph.boards.map((one) => one.id);
  const placed = new Set<string>();
  const ordered: string[] = [];
  let left = [...ids];
  while (left.length > 0) {
    const ready = left.filter((id) => inputsOf(graph, id).every((edge) => placed.has(edge.fromBoardId) || !ids.includes(edge.fromBoardId)));
    const batch = ready.length > 0 ? ready : left;
    for (const id of batch) {
      ordered.push(id);
      placed.add(id);
    }
    left = left.filter((id) => !placed.has(id));
  }
  return ordered;
}

export interface ScopeInput {
  /** The board the person pressed the button on. Null is only allowed with the whole canvas. */
  readonly from: string | null;
  readonly scope: FlowScope;
}

/**
 * The boards one press should run, in order and without the ones that are not run at all.
 *
 *   * `board` -- Regenerate: this board alone.
 *   * `downstream` -- Run all downstream: this board and everything it feeds.
 *   * `all` -- Run all: every board of the canvas.
 */
export function runnableIds(graph: Graph, input: ScopeInput): readonly string[] {
  const ids = ((): readonly string[] => {
    if (input.scope === "all") return topologicalOrder(graph);
    if (input.from === null) return [];
    if (input.scope === "board") return [input.from];
    return [input.from, ...runOrder(graph, input.from)];
  })();
  return ids.filter((id) => isRunnable(graph, id));
}

/** Every board this one feeds, directly or through others. The set a failure takes with it. */
export function dependentsOf(graph: Graph, boardId: string): ReadonlySet<string> {
  const found = new Set<string>();
  const walk = (id: string): void => {
    for (const edge of outputsOf(graph, id)) {
      if (found.has(edge.toBoardId)) continue;
      found.add(edge.toBoardId);
      walk(edge.toBoardId);
    }
  };
  walk(boardId);
  return found;
}

/** How many boards feed this one, so the canvas can say "2 of 4 inputs connected". */
export const inputCount = (graph: Graph, boardId: string): number => inputsOf(graph, boardId).length;
