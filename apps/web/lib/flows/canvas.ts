import {
  BOARDS,
  canConnect,
  inputsOf,
  kindsAddableAfter,
  nextInput,
  type BoardKind,
  type BoardView,
  type Graph,
  type Point,
} from "@/lib/launch";
import { FLOW_GAP_RULE } from "./types";

/**
 * The canvas, as the spec draws it: connectors from a board's right-edge dot, an "Add…" menu on
 * that dot, fan-out and fan-in (F-L4).
 *
 * L1's canvas scrolls and lays its boards out in a row; it left the connectors and the dragging to
 * this workstream and put `moveBoard` and `resizeBoard` in the contract for it. Everything here is
 * maths and lists -- no component, no event -- so the hard part of a node canvas is tested without
 * a browser.
 *
 * **THE CANVAS WORKS WITHOUT A MOUSE.** A node canvas that needs dragging is a canvas half the
 * people who open it cannot use, so every one of the three things a person does on it has a keyboard
 * path and the path is the same shape as the pointer one:
 *
 *   * *selecting* -- the boards are a list in reading order, so Tab reaches each one;
 *   * *moving* -- the arrow keys nudge the selected board by the grid, Shift by ten of them, and the
 *     board's new place goes through `moveBoard` exactly as a drag would;
 *   * *connecting* -- the dot opens a menu of the boards it may feed, with the input each connector
 *     would take, so a connector is drawn by choosing from a list instead of by aiming.
 */

/** The grid the canvas snaps to, so boards line up without anybody aiming. */
export const GRID_PX = 8;

/** What the database will take for a board's place (migration 20261201010000). */
export const CANVAS_MIN = -1_000_000;
export const CANVAS_MAX = 1_000_000;

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value));
/** Snapped to the grid. The `|| 0` is there so a place just left of the origin is 0 and not -0. */
const snap = (value: number): number => Math.round(value / GRID_PX) * GRID_PX || 0;

/** A place on the canvas, snapped to the grid and inside what a board's place may be. */
export const placeOf = (at: Point): Point => ({
  x: clamp(snap(at.x), CANVAS_MIN, CANVAS_MAX),
  y: clamp(snap(at.y), CANVAS_MIN, CANVAS_MAX),
});

/** Where a drag ends: where it started, plus how far the pointer moved, snapped to the grid. */
export const dragTo = (board: BoardView, by: Point): Point => placeOf({ x: board.at.x + by.x, y: board.at.y + by.y });

export const ARROW_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"] as const;
export type ArrowKey = (typeof ARROW_KEYS)[number];

export const isArrowKey = (key: string): key is ArrowKey => (ARROW_KEYS as readonly string[]).includes(key);

/** The keyboard's own drag: one grid step, or ten with Shift held. */
export function nudge(board: BoardView, key: ArrowKey, shift = false): Point {
  const step = GRID_PX * (shift ? 10 : 1);
  const by: Point =
    key === "ArrowLeft" ? { x: -step, y: 0 } : key === "ArrowRight" ? { x: step, y: 0 } : key === "ArrowUp" ? { x: 0, y: -step } : { x: 0, y: step };
  return dragTo(board, by);
}

/** The right-edge dot a connector leaves from (spec F-L4: "each connector runs from a board's right-edge dot"). */
export const outputDot = (board: BoardView): Point => ({ x: board.at.x + board.size.width, y: board.at.y + Math.round(board.size.height / 2) });

/**
 * The dot a connector ends at: one per input, spread down the board's left edge, so "image 1" and
 * "image 2" are in the same places on every board of a kind.
 */
export function inputDot(board: BoardView, inputIndex: number): Point {
  const slots = Math.max(1, BOARDS[board.kind].maxInputs);
  const index = clamp(inputIndex, 1, slots);
  return { x: board.at.x, y: board.at.y + Math.round((board.size.height * index) / (slots + 1)) };
}

/**
 * A curved connector from one board's dot to another's input dot, as an SVG path. The curve leaves
 * and arrives horizontally, so a connector reads as a flow from left to right even when the boards
 * are stacked.
 */
export function connectorPath(from: BoardView, to: BoardView, inputIndex: number): string {
  const start = outputDot(from);
  const end = inputDot(to, inputIndex);
  const span = Math.max(48, Math.abs(end.x - start.x) / 2);
  return `M ${start.x} ${start.y} C ${start.x + span} ${start.y}, ${end.x - span} ${end.y}, ${end.x} ${end.y}`;
}

export interface Connector {
  readonly edgeId: string;
  readonly fromBoardId: string;
  readonly toBoardId: string;
  readonly inputIndex: number;
  readonly path: string;
  /** What a screen reader says for the connector, and what the Cut button's label repeats. */
  readonly label: string;
}

/** Every connector on the canvas, with its curve and its words. */
export function connectorsOf(graph: Graph): readonly Connector[] {
  return graph.edges.flatMap((edge): readonly Connector[] => {
    const from = graph.boards.find((one) => one.id === edge.fromBoardId);
    const to = graph.boards.find((one) => one.id === edge.toBoardId);
    if (!from || !to) return [];
    return [
      {
        edgeId: edge.id,
        fromBoardId: from.id,
        toBoardId: to.id,
        inputIndex: edge.inputIndex,
        path: connectorPath(from, to, edge.inputIndex),
        label: `${from.name || BOARDS[from.kind].label} feeds input ${edge.inputIndex} of ${to.name || BOARDS[to.kind].label}`,
      },
    ];
  });
}

export interface AddItem {
  readonly kind: BoardKind;
  readonly label: string;
  readonly lead: string;
  /** True when running the new board will cost credits, so the menu says so before it is added. */
  readonly paid: boolean;
  readonly ruleId: string;
}

/** The connector dot's Add… menu: only the kinds the spec's table lets this board feed. */
export const addMenuFor = (board: BoardView): readonly AddItem[] =>
  kindsAddableAfter(board.kind).map((kind) => ({
    kind,
    label: BOARDS[kind].label,
    lead: BOARDS[kind].lead,
    paid: BOARDS[kind].paid,
    ruleId: FLOW_GAP_RULE,
  }));

export interface ConnectTarget {
  readonly boardId: string;
  readonly name: string;
  /** The input the connector would take, or null when the board is full. */
  readonly inputIndex: number | null;
  /** Why this connector cannot be drawn, or null. The item stays in the list and says why. */
  readonly blocked: string | null;
}

/**
 * The keyboard's way of drawing a connector: every other board on the canvas, with the input a
 * connector from this one would take and, where it would be refused, L1's own words for why. Fan-in
 * is a target whose next free input is 2; a board that is full says so instead of disappearing.
 */
export function connectTargets(graph: Graph, fromBoardId: string): readonly ConnectTarget[] {
  return graph.boards
    .filter((board) => board.id !== fromBoardId)
    .map((board): ConnectTarget => {
      const index = nextInput(graph, board.id);
      if (index === null) {
        const full = BOARDS[board.kind].maxInputs === 0;
        return {
          boardId: board.id,
          name: board.name || BOARDS[board.kind].label,
          inputIndex: null,
          blocked: full ? `A ${BOARDS[board.kind].label} board takes nothing from another board.` : "Every input of this board is already connected.",
        };
      }
      const verdict = canConnect(graph, fromBoardId, board.id, index);
      return {
        boardId: board.id,
        name: board.name || BOARDS[board.kind].label,
        inputIndex: index,
        blocked: verdict.allowed ? null : verdict.reason,
      };
    });
}

/** How full a board's inputs are, for the board's own line ("2 of 4 inputs"). */
export function inputState(graph: Graph, board: BoardView): string {
  const slots = BOARDS[board.kind].maxInputs;
  if (slots === 0) return "Nothing feeds this board, by design";
  const used = inputsOf(graph, board.id).length;
  return used === 0 ? `Nothing feeds this yet, of ${slots}` : `${used} of ${slots} ${slots === 1 ? "input" : "inputs"} connected`;
}

/** The canvas's own size, so the scrolling region is as big as the boards on it and no bigger. */
export function extentOf(graph: Graph): Readonly<{ width: number; height: number; x: number; y: number }> {
  if (graph.boards.length === 0) return { width: 0, height: 0, x: 0, y: 0 };
  const left = Math.min(...graph.boards.map((one) => one.at.x));
  const top = Math.min(...graph.boards.map((one) => one.at.y));
  const right = Math.max(...graph.boards.map((one) => one.at.x + one.size.width));
  const bottom = Math.max(...graph.boards.map((one) => one.at.y + one.size.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}
