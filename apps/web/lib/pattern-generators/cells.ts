import type { BoundsMm, PointMm } from "@/lib/artwork-stack/units";
import { span } from "./geometry";

/** The cells of a grid anchored at `origin` that come within `reach` of the bounds. Cells are named by whole numbers, so a cell is the same whatever area is drawn: that is what makes a field continuous. */
export function cellsNear(bounds: BoundsMm, origin: PointMm, cellW: number, cellH: number, reach: number): { i: number; j: number }[] {
  const [i0, i1] = [Math.floor((bounds.minX - origin.x - reach) / cellW), Math.floor((bounds.maxX - origin.x + reach) / cellW)];
  const [j0, j1] = [Math.floor((bounds.minY - origin.y - reach) / cellH), Math.floor((bounds.maxY - origin.y + reach) / cellH)];
  return span(j0, j1).flatMap((j) => span(i0, i1).map((i) => ({ i, j })));
}

export const areaOf = (bounds: BoundsMm): { w: number; h: number } => ({ w: bounds.maxX - bounds.minX, h: bounds.maxY - bounds.minY });

/** How many cells of this size `cellsNear` will visit, near enough to plan a budget. */
export function cellEstimate(bounds: BoundsMm, cellW: number, cellH: number, reach: number): number {
  const { w, h } = areaOf(bounds);
  return (Math.ceil((w + 2 * reach) / cellW) + 1) * (Math.ceil((h + 2 * reach) / cellH) + 1);
}
