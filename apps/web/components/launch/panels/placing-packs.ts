import type { BoardView, Point } from "@/lib/launch";

/** The gap between what is on the canvas already and a pack dropped beside it, in canvas pixels. */
export const PACK_GAP = 80;

/**
 * Where a launch pack is dropped, so a second pack does not land on top of the first (the `x` and
 * `y` of `applyFlowTemplateBody`, which the pack's own layout is measured from).
 *
 * To the right of everything already on the canvas, level with its top. An empty canvas drops the
 * pack at the origin. Pure, so the panel holds no arithmetic of its own.
 */
export function dropOrigin(boards: readonly BoardView[]): Point {
  if (boards.length === 0) return { x: 0, y: 0 };
  const right = Math.max(...boards.map((board) => board.at.x + board.size.width));
  const top = Math.min(...boards.map((board) => board.at.y));
  return { x: Math.round(right + PACK_GAP), y: Math.round(top) };
}
