import type { BoundsMm, PointMm } from "@/lib/artwork-stack/units";
import { roundMm } from "@/lib/artwork-stack/units";
import type { Tile } from "./define";
import { span } from "./geometry";

const ORIGIN: PointMm = { x: 0, y: 0 };

/** How many tiles of this size cover the bounds, with `pad` extra tiles on every side. */
export function tileCount(bounds: BoundsMm, tile: Tile, pad: number): number {
  const across = Math.ceil((bounds.maxX - bounds.minX) / tile.width) + 1 + 2 * pad;
  const down = Math.ceil((bounds.maxY - bounds.minY) / tile.height) + 1 + 2 * pad;
  return across * down;
}

/**
 * The tiles that cover the bounds, each with its top left corner. Tiles sit a whole number of tiles from the datum, and
 * corners are rounded to 0.01 mm, so every copy is exactly one tile from the next and the repeat is the same on any area.
 * `pad` adds tiles around the edge for shapes that reach over their tile.
 */
export function tilesOver(bounds: BoundsMm, tile: Tile, pad: number, datum: PointMm = ORIGIN): { i: number; j: number; origin: PointMm }[] {
  const [i0, i1] = [Math.floor((bounds.minX - datum.x) / tile.width) - pad, Math.floor((bounds.maxX - datum.x) / tile.width) + pad];
  const [j0, j1] = [Math.floor((bounds.minY - datum.y) / tile.height) - pad, Math.floor((bounds.maxY - datum.y) / tile.height) + pad];
  return span(j0, j1).flatMap((j) => span(i0, i1).map((i) => ({ i, j, origin: { x: roundMm(datum.x + i * tile.width), y: roundMm(datum.y + j * tile.height) } })));
}
