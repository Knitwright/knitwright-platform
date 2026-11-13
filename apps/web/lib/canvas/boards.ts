import { CARD_SIZE } from "@/lib/flows/canvas";
import { BOARDS, type BoardKind, type BoardView, type Graph } from "@/lib/launch";
import { boundsOf, intersects, visibleRect, type Point, type Rect, type Size, type Viewport } from "./viewport";

/**
 * Boards on the one canvas (decision 0145): where each one's box is in the world, the connectors
 * between the boxes, which boxes the screen shows (culling) and which a marquee catches.
 *
 * WHAT A BOARD'S BOX IS. A garment, tech pack or order board stores its box on the canvas in its
 * own `width`/`height` -- the migration makes a garment board 320 × 380. A launch kind's
 * `width`/`height` is the artboard it *exports* at (1080 × 1920 for a story), and L6 laid launch
 * packs out 360 units apart for cards of `CARD_SIZE`; drawing those at their artboard size would
 * pile every pack on top of itself. So a launch kind's box is the card, and its artboard size is
 * the inspector's to show. A board's place is always its own `x`/`y`.
 */

/** The box a new garment board gets, in world units. The migration uses the same figures. */
export const GARMENT_BOX: Size = { width: 320, height: 380 };
/** Tech pack and order boards: their pages or their order above the card (E4, decision 0148). */
export const LINKED_BOX: Size = { width: 320, height: 360 };

const OWN_BOX_KINDS: readonly BoardKind[] = ["garment", "tech_pack", "order"];

export const hasOwnBox = (kind: BoardKind): boolean => OWN_BOX_KINDS.includes(kind);

/** The board's box in world units. */
export function boxOf(board: BoardView): Rect {
  // A tech pack or order board stored before E4 at 320 × 220 grows to the box its body needs.
  const least = board.kind === "tech_pack" || board.kind === "order" ? LINKED_BOX : CARD_SIZE;
  const size = hasOwnBox(board.kind)
    ? { width: Math.max(least.width, board.size.width), height: Math.max(least.height, board.size.height) }
    : CARD_SIZE;
  return { x: board.at.x, y: board.at.y, width: size.width, height: size.height };
}

/** The size a new board of a kind is given, so the box it is drawn in is the one it is stored with. */
export const newBoardSize = (kind: BoardKind): Size | null =>
  kind === "garment" ? GARMENT_BOX : kind === "tech_pack" || kind === "order" ? LINKED_BOX : null;

/** The right-edge dot a connector leaves from. */
export const outDot = (box: Rect): Point => ({ x: box.x + box.width, y: box.y + Math.round(box.height / 2) });

/** The left-edge dot of one numbered input, spread down the edge as L6 spreads them. */
export function inDot(box: Rect, kind: BoardKind, inputIndex: number): Point {
  const slots = Math.max(1, BOARDS[kind].maxInputs);
  const index = Math.min(slots, Math.max(1, inputIndex));
  return { x: box.x, y: box.y + Math.round((box.height * index) / (slots + 1)) };
}

/** The curve between two dots: it leaves and arrives level, so a flow reads left to right. */
export function curve(start: Point, end: Point): string {
  const span = Math.max(48, Math.abs(end.x - start.x) / 2);
  return `M ${start.x} ${start.y} C ${start.x + span} ${start.y}, ${end.x - span} ${end.y}, ${end.x} ${end.y}`;
}

export interface CanvasConnector {
  readonly edgeId: string;
  readonly fromBoardId: string;
  readonly toBoardId: string;
  readonly path: string;
  /** The box around the curve's two ends, for culling. */
  readonly span: Rect;
}

/** Every connector, drawn between the boxes the boards are really drawn in. Fan-in and fan-out alike. */
export function connectorsBetween(graph: Graph): readonly CanvasConnector[] {
  const byId = new Map(graph.boards.map((board) => [board.id, board]));
  return graph.edges.flatMap((edge): readonly CanvasConnector[] => {
    const from = byId.get(edge.fromBoardId);
    const to = byId.get(edge.toBoardId);
    if (!from || !to) return [];
    const start = outDot(boxOf(from));
    const end = inDot(boxOf(to), to.kind, edge.inputIndex);
    const span = boundsOf([
      { x: start.x, y: start.y, width: 0, height: 0 },
      { x: end.x, y: end.y, width: 0, height: 0 },
    ]) as Rect;
    return [{ edgeId: edge.id, fromBoardId: from.id, toBoardId: to.id, path: curve(start, end), span }];
  });
}

/** The box around every board, for fit to content, or null on an empty canvas. */
export const contentBounds = (boards: readonly BoardView[]): Rect | null => boundsOf(boards.map(boxOf));

/** How far past the screen's edge a board is still drawn, in screen pixels, so a pan never shows a gap. */
export const CULL_MARGIN = 240;

/**
 * Below this many boards nothing is culled: a small canvas costs nothing to draw whole, and every
 * board stays in the page for search, assistive technology and a person's Find.
 */
export const CULL_FROM = 24;

/**
 * Culling: on a canvas of `CULL_FROM` boards or more, the boards whose box the screen (plus the
 * margin) shows. The selected boards are always kept, so the one a person is working on never
 * leaves the page -- and with it its keyboard focus.
 */
export function visibleBoards(boards: readonly BoardView[], view: Viewport, screen: Size, keep: readonly string[] = []): readonly BoardView[] {
  if (boards.length < CULL_FROM) return boards;
  const shown = visibleRect(view, screen, CULL_MARGIN);
  return boards.filter((board) => keep.includes(board.id) || intersects(boxOf(board), shown));
}

/** The connectors whose curve could cross the screen. */
export function visibleConnectors(connectors: readonly CanvasConnector[], view: Viewport, screen: Size): readonly CanvasConnector[] {
  const shown = visibleRect(view, screen, CULL_MARGIN);
  // A level curve has zero height; grow the span by a unit so it can still intersect.
  return connectors.filter((one) => intersects({ ...one.span, width: one.span.width + 1, height: one.span.height + 1 }, shown));
}

/** The boards a marquee catches: any whose box it touches, in canvas order. */
export const marqueeHits = (boards: readonly BoardView[], rect: Rect): readonly string[] =>
  boards.filter((board) => intersects(boxOf(board), rect)).map((board) => board.id);

/** The board Tab moves to from `current`, in reading order, wrapping at either end. */
export function nextInOrder(boards: readonly BoardView[], current: string | null, back: boolean): string | null {
  if (boards.length === 0) return null;
  const at = current === null ? -1 : boards.findIndex((board) => board.id === current);
  if (at === -1) return (back ? boards.at(-1) : boards[0])?.id ?? null;
  const next = (at + (back ? -1 : 1) + boards.length) % boards.length;
  return boards[next]?.id ?? null;
}
