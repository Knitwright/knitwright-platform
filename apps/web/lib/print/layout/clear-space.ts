import { shapeArea, subtractRegions, type Shape } from "../geometry/boolean";
import { boundsOf, type Pt } from "../geometry/vec";

/**
 * A motif is a shape small enough to be one repeat of a pattern, such as a polka dot. Beside a mark it is left out
 * whole rather than cut, as the older dots drawing does. Anything bigger is cut to the clear space. This is a setting,
 * not a measurement.
 */
export const MOTIF_MAX_MM = 80;

const isMotif = (shape: Shape): boolean => {
  const b = boundsOf(shape.flat());
  return Math.max(b.maxX - b.minX, b.maxY - b.minY) <= MOTIF_MAX_MM;
};

/** Keeps the shapes clear of the regions: a motif that touches one is dropped whole, a larger shape is cut. */
export function keepClear(shapes: readonly Shape[], regions: readonly (readonly Pt[])[]): Shape[] {
  if (regions.length === 0) return [...shapes];
  const out: Shape[] = [];
  for (const shape of shapes) {
    const cut = subtractRegions([shape], regions);
    if (cut.length === 1 && cut[0] === shape) {
      out.push(shape);
      continue;
    }
    const lost = shapeArea(shape) - cut.reduce((sum, s) => sum + shapeArea(s), 0);
    if (lost <= 1e-6) out.push(shape);
    else if (!isMotif(shape)) out.push(...cut);
  }
  return out;
}

/** The same, for shapes that carry a fill: each keeps its colour. */
export function keepClearFilled<T extends { readonly shape: Shape }>(items: readonly T[], regions: readonly (readonly Pt[])[]): T[] {
  return items.flatMap((item) => keepClear([item.shape], regions).map((shape) => ({ ...item, shape })));
}
