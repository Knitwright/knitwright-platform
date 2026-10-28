import type { Box } from "../scene";
import { applyAll } from "../geometry/affine";
import { boundsOf } from "../geometry/polygon";
import type { PieceFrame } from "../frames/frame";
import type { PieceInstance } from "../frames/instances";

/** How far above the chest line a repeat field starts, at least. Fixed, so the field does not move from size to size. */
const FIELD_TOP_MM = 400;
/** Room kept beyond the garment on the other three sides. */
const MARGIN_MM = 100;

/** Sound means every edge is a number and the box has some width and height. */
export const isSound = (box: Box): boolean =>
  [box.minX, box.minY, box.maxX, box.maxY].every(Number.isFinite) && box.maxX > box.minX && box.maxY > box.minY;

/**
 * The one box every piece of a garment asks a generator to draw over. Generators that grow their rows from the edge of
 * the box (the seven older styles do) then draw the same field on the front, the back and the sleeves, so rows meet at
 * the side seam and the underarm. The box is the garment's own extent in design space, centred on the centre line, and
 * starts a fixed distance above the chest line.
 */
export function fieldBoundsFor(placed: readonly { readonly instance: PieceInstance; readonly frame: PieceFrame }[], chestPosition: number): Box {
  const chestY = Number.isFinite(chestPosition) ? chestPosition : 0;
  const boxes = placed.map(({ instance, frame }) => boundsOf(applyAll(frame.toDesign, instance.opened))).filter(isSound);
  const reach = Math.max(0, ...boxes.map((box) => Math.max(Math.abs(box.minX), Math.abs(box.maxX)))) + MARGIN_MM;
  const top = Math.min(chestY - FIELD_TOP_MM, ...boxes.map((box) => box.minY - MARGIN_MM));
  const bottom = Math.max(chestY, ...boxes.map((box) => box.maxY + MARGIN_MM));
  return { minX: -reach, maxX: reach, minY: top, maxY: bottom };
}
