import type { PointMm } from "@/lib/artwork-stack";
import type { Pt } from "../geometry/vec";
import type { ImageSet } from "./images";
import type { PrintSpace } from "./print-space";
import type { FilledShape, Issue } from "./scene";

/**
 * What a placed layer (a logo, text or a player's mark) contributes to a piece, worked out before anything is
 * painted, because its clear space has to be cut out of the layers beneath it.
 */
export interface MarkPlan {
  readonly layerId: string;
  /** Position in the stack: layers with a lower position lie beneath this one. */
  readonly index: number;
  readonly shapes: readonly FilledShape[];
  readonly images: ImageSet | null;
  /** The ink's bounding rectangle on the design plane (four corners). Null when nothing was placed. */
  readonly core: readonly PointMm[] | null;
  /** The clear space this layer asks for around its core, in millimetres. */
  readonly ownClearMm: number;
  /** True when the layer cuts the layers beneath it, instead of printing over them. */
  readonly cuts: boolean;
  /** A knock-out layer paints nothing: its shape is a hole in the layers beneath. */
  readonly paintsNothing: boolean;
  readonly issues: readonly Issue[];
  readonly notes: readonly string[];
  readonly lowestDpi: number | null;
}

export const emptyPlan = (layerId: string, index: number, issues: readonly Issue[]): MarkPlan => ({
  layerId,
  index,
  shapes: [],
  images: null,
  core: null,
  ownClearMm: 0,
  cuts: false,
  paintsNothing: false,
  issues,
  notes: [],
  lowestDpi: null,
});

/** The four corners of a width by height rectangle centred on a point and turned clockwise (the plane runs y down). */
export function turnedRect(centre: PointMm, widthMm: number, heightMm: number, rotationDeg: number): PointMm[] {
  const r = (rotationDeg * Math.PI) / 180;
  const [c, s] = [Math.cos(r), Math.sin(r)];
  return [
    [-widthMm / 2, -heightMm / 2],
    [widthMm / 2, -heightMm / 2],
    [widthMm / 2, heightMm / 2],
    [-widthMm / 2, heightMm / 2],
  ].map(([u, v]) => ({ x: centre.x + u * c - v * s, y: centre.y + u * s + v * c }));
}

/** The upright rectangle round some points, grown on every side. */
export function grownBox(points: readonly PointMm[], by: number): PointMm[] {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs) - by, Math.max(...xs) + by, Math.min(...ys) - by, Math.max(...ys) + by];
  return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
}

/** The region of a mark that layers beneath must keep out of, in print space. */
export const clearRegion = (plan: MarkPlan, extraMm: number, space: PrintSpace): Pt[] | null =>
  plan.core === null ? null : grownBox(plan.core, Math.max(plan.cuts ? plan.ownClearMm : 0, extraMm)).map(space.toPrint);

export const insideRect = (inner: readonly PointMm[], outer: readonly PointMm[], slackMm = 0.01): boolean => {
  const [a, b] = [grownBox(inner, 0), grownBox(outer, slackMm)];
  return a[0].x >= b[0].x && a[1].x <= b[1].x && a[0].y >= b[0].y && a[2].y <= b[2].y;
};
