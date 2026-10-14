import type { DisplayList, DisplayShape } from "@/lib/artwork-stack/generator";
import { roundMm, type BoundsMm, type PointMm } from "@/lib/artwork-stack/units";
import { clipPolygon, rounded } from "./geometry";

/** The most shapes one piece may take (plan W7c). Past it a generator draws fewer, larger marks and says so. */
export const SHAPE_BUDGET = 20_000;

export const BUDGET_NOTE = "Simplified to stay within 20 000 shapes: fewer, larger marks than the settings ask for.";

/** A polygon cut to the box, at 0.01 mm, or nothing when it falls outside. */
export function clippedShape(points: readonly PointMm[], box: BoundsMm, fill: string): DisplayShape[] {
  const cut = clipPolygon(points, box);
  return cut === null ? [] : [{ kind: "polygon", fill, points: rounded(cut) }];
}

export const circleShape = (centre: PointMm, radius: number, fill: string): DisplayShape => ({
  kind: "circle",
  centre: { x: roundMm(centre.x), y: roundMm(centre.y) },
  radius: roundMm(radius),
  fill,
});

/**
 * How much to enlarge a pattern's unit so its shape count stays within the budget: 1 when it already does,
 * else the factor on both sides of the unit.
 */
export const budgetFactor = (estimatedShapes: number): number => (estimatedShapes <= SHAPE_BUDGET ? 1 : Math.sqrt(estimatedShapes / SHAPE_BUDGET));

/** The display list, noting any simplification. A count still over the budget is cut at the budget. */
export function listOf(shapes: readonly DisplayShape[], simplified: boolean): DisplayList {
  const over = shapes.length > SHAPE_BUDGET;
  return simplified || over ? { shapes: over ? shapes.slice(0, SHAPE_BUDGET) : shapes, note: BUDGET_NOTE } : { shapes };
}
