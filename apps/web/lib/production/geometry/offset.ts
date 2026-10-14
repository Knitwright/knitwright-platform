import { EndType, JoinType, inflatePathsD } from "clipper2-ts";
import type { Point } from "../contract/pieces";

/** Millimetres are kept to this many decimals, which is the 0.01 mm the files are written at. */
const PRECISION = 2;
const MITER_LIMIT = 2;

export type OffsetJoin = "round" | "miter";

/**
 * Grows a closed outline outwards by `distanceMm`, or shrinks it when the distance is negative.
 * Used for seam allowance and bleed. Returns the outline with the most points when the offset
 * splits it, which does not happen for a sewing piece of sensible size.
 */
export function offsetOutline(outline: readonly Point[], distanceMm: number, join: OffsetJoin = "round"): Point[] {
  if (!Number.isFinite(distanceMm)) throw new RangeError("The offset distance must be a number.");
  if (outline.length < 3) throw new RangeError("An outline needs at least three points.");
  const path = outline.map(([x, y]) => ({ x, y }));
  const joinType = join === "round" ? JoinType.Round : JoinType.Miter;
  const result = inflatePathsD([path], distanceMm, joinType, EndType.Polygon, MITER_LIMIT, PRECISION);
  const longest = result.reduce<(typeof result)[number] | undefined>((a, b) => (a && a.length >= b.length ? a : b), undefined);
  return (longest ?? []).map((p): Point => [p.x, p.y]);
}

/** The area of a closed outline in square millimetres, always positive. */
export function outlineArea(outline: readonly Point[]): number {
  let sum = 0;
  for (let i = 0; i < outline.length; i += 1) {
    const [x1, y1] = outline[i];
    const [x2, y2] = outline[(i + 1) % outline.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}
