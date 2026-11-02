import { BOARDS, LAUNCH_GAP_RULE, type BoardKind } from "./boards";
import type { BoardLink, BoardView } from "./types";

/**
 * The canvas as a graph: which board feeds which, in which numbered input, and what that means for
 * running a board.
 *
 * Two rules live here and nowhere else.
 *
 *   * **The garment is always locked.** A board only runs when a Design board can be reached by
 *     following its connectors backwards. The garment in every picture is therefore the one the
 *     platform drew for that design version, never something a model invented (spec decision 13,
 *     wave 4 preamble). `garmentSource` is the one answer to "whose garment is this?", and
 *     `runnable` refuses a board that has no answer.
 *   * **A connector the spec's table does not allow cannot be drawn.** `canConnect` checks the
 *     kinds, the input number, the fan-in limit and cycles, so the canvas cannot be wired into a
 *     shape that could never run.
 */

export interface Graph {
  readonly boards: readonly BoardView[];
  readonly edges: readonly BoardLink[];
}

const boardById = (graph: Graph, id: string): BoardView | null => graph.boards.find((board) => board.id === id) ?? null;

/** The connectors ending at a board, in input order, so "image 1" is always the same picture. */
export function inputsOf(graph: Graph, boardId: string): readonly BoardLink[] {
  return [...graph.edges.filter((edge) => edge.toBoardId === boardId)].sort((a, b) => a.inputIndex - b.inputIndex);
}

/** The connectors leaving a board, in the order their targets were added. */
export const outputsOf = (graph: Graph, boardId: string): readonly BoardLink[] => graph.edges.filter((edge) => edge.fromBoardId === boardId);

export type GarmentSource =
  /** The Design board every picture on this branch starts from, and the version it was taken at. */
  | Readonly<{ locked: true; boardId: string; designProjectId: string | null; version: number | null }>
  | Readonly<{ locked: false; reason: string; ruleId: string }>;

const designProjectOf = (board: BoardView): string | null => {
  const value = board.settings["designProjectId"];
  return typeof value === "string" && value.length > 0 ? value : null;
};

/**
 * The Design board this board's pictures come from, found by walking the connectors backwards.
 * A board with no Design board behind it is not locked to a garment, and nothing may be generated
 * from it.
 */
export function garmentSource(graph: Graph, boardId: string): GarmentSource {
  const seen = new Set<string>();
  const queue = [boardId];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    const board = boardById(graph, id);
    if (!board) continue;
    if (board.kind === "design") {
      return { locked: true, boardId: board.id, designProjectId: designProjectOf(board), version: board.inputVersion };
    }
    for (const edge of inputsOf(graph, id)) queue.push(edge.fromBoardId);
  }
  return {
    locked: false,
    reason: "Connect a Design board first: every picture starts from the design the platform drew.",
    ruleId: LAUNCH_GAP_RULE,
  };
}

export type ConnectVerdict = Readonly<{ allowed: true }> | Readonly<{ allowed: false; reason: string; ruleId: string }>;

const refuse = (reason: string): ConnectVerdict => ({ allowed: false, reason, ruleId: LAUNCH_GAP_RULE });

/** "an AI image board", "a Mockup board": the right article for a board's own label. */
const named = (kind: BoardKind): string => `${/^[AEIOU]/.test(BOARDS[kind].label) ? "an" : "a"} ${BOARDS[kind].label} board`;

const sentence = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

/** Whether `from` can be reached from `to` by following connectors forwards, which would be a loop. */
function reaches(graph: Graph, from: string, to: string): boolean {
  const seen = new Set<string>();
  const queue = [from];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (id === to) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const edge of outputsOf(graph, id)) queue.push(edge.toBoardId);
  }
  return false;
}

/** Whether a connector may be drawn from one board into one numbered input of another. */
export function canConnect(graph: Graph, fromBoardId: string, toBoardId: string, inputIndex: number): ConnectVerdict {
  if (fromBoardId === toBoardId) return refuse("A board cannot feed itself.");
  const from = boardById(graph, fromBoardId);
  const to = boardById(graph, toBoardId);
  if (!from || !to) return refuse("That board is not on this canvas.");
  const info = BOARDS[to.kind];
  if (info.maxInputs === 0) return refuse(sentence(`${named(to.kind)} takes nothing from another board.`));
  if (!info.accepts.includes(from.kind)) return refuse(sentence(`${named(to.kind)} cannot start from ${named(from.kind)}.`));
  if (inputIndex < 1 || inputIndex > info.maxInputs) {
    return refuse(sentence(`${named(to.kind)} has ${info.maxInputs} input${info.maxInputs === 1 ? "" : "s"}.`));
  }
  const already = inputsOf(graph, toBoardId);
  if (already.some((edge) => edge.inputIndex === inputIndex)) return refuse(`Input ${inputIndex} is already connected.`);
  if (already.some((edge) => edge.fromBoardId === fromBoardId)) return refuse("That board already feeds this one.");
  if (reaches(graph, toBoardId, fromBoardId)) return refuse("That would make a loop, and a loop could never finish.");
  return { allowed: true };
}

/** The next free input of a board, for the connector dot's Add… menu, or null when it is full. */
export function nextInput(graph: Graph, boardId: string): number | null {
  const board = boardById(graph, boardId);
  if (!board) return null;
  const taken = new Set(inputsOf(graph, boardId).map((edge) => edge.inputIndex));
  for (let index = 1; index <= BOARDS[board.kind].maxInputs; index += 1) if (!taken.has(index)) return index;
  return null;
}

export type RunVerdict = Readonly<{ canRun: true }> | Readonly<{ canRun: false; reason: string; ruleId: string }>;

/**
 * Whether a board can be run now: its inputs are connected and a Design board is behind it. A
 * Design board and an Artboard are not run at all -- the platform draws them from what they hold.
 */
export function runnable(graph: Graph, boardId: string): RunVerdict {
  const board = boardById(graph, boardId);
  if (!board) return { canRun: false, reason: "That board is not on this canvas.", ruleId: LAUNCH_GAP_RULE };
  const info = BOARDS[board.kind];
  if (info.maxInputs === 0) {
    return { canRun: false, reason: sentence(`${named(board.kind)} holds what you put in it; there is nothing to run.`), ruleId: LAUNCH_GAP_RULE };
  }
  if (inputsOf(graph, boardId).length === 0) {
    return { canRun: false, reason: `Connect a board into this ${info.label} board first.`, ruleId: LAUNCH_GAP_RULE };
  }
  const source = garmentSource(graph, boardId);
  if (!source.locked) return { canRun: false, reason: source.reason, ruleId: source.ruleId };
  return { canRun: true };
}

/**
 * "Run all downstream" (spec F-L4): every board the chosen one feeds, in an order where a board
 * always comes after the boards that feed it. The canvas has no loops, so the order always exists.
 */
export function runOrder(graph: Graph, fromBoardId: string): readonly string[] {
  const downstream = new Set<string>();
  const walk = (id: string): void => {
    for (const edge of outputsOf(graph, id)) {
      if (downstream.has(edge.toBoardId)) continue;
      downstream.add(edge.toBoardId);
      walk(edge.toBoardId);
    }
  };
  walk(fromBoardId);

  const ordered: string[] = [];
  const placed = new Set<string>([fromBoardId]);
  let left = [...downstream];
  while (left.length > 0) {
    const ready = left.filter((id) => inputsOf(graph, id).every((edge) => placed.has(edge.fromBoardId) || !downstream.has(edge.fromBoardId)));
    // A board whose other input sits outside the run is still ready; only a board fed by one not
    // yet placed waits. With no loops, `ready` is never empty while boards are left.
    const batch = ready.length > 0 ? ready : left;
    for (const id of batch) {
      ordered.push(id);
      placed.add(id);
    }
    left = left.filter((id) => !placed.has(id));
  }
  return ordered;
}

/** The kinds on this canvas, for the empty state and the run summary. */
export const kindsOnCanvas = (graph: Graph): readonly BoardKind[] => [...new Set(graph.boards.map((board) => board.kind))];
