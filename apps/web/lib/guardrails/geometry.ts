import type { Box, Point } from "./types";
import { signedArea as ringSignedArea } from "@/lib/print/geometry/polygon";

type Seg = readonly [Point, Point];

export const edgesOf = (poly: readonly Point[]): Seg[] => poly.map((p, i) => [p, poly[(i + 1) % poly.length] as Point]);

export const boxCorners = (b: Box): Point[] => [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]];

export const boxEdges = (b: Box): Seg[] => edgesOf(boxCorners(b));

/** Even-odd test. A point on the line may fall either way. */
export function pointInPolygon([x, y]: Point, poly: readonly Point[]): boolean {
  let inside = false;
  for (const [[ax, ay], [bx, by]] of edgesOf(poly)) {
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}

/** The point where two segments cross, or null. */
export function segmentCross([a, b]: Seg, [c, d]: Seg): Point | null {
  const r: Point = [b[0] - a[0], b[1] - a[1]];
  const s: Point = [d[0] - c[0], d[1] - c[1]];
  const denom = r[0] * s[1] - r[1] * s[0];
  if (denom === 0) return null;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / denom;
  const u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [a[0] + t * r[0], a[1] + t * r[1]] : null;
}

/** Where a line (not a polygon) crosses the edges of a box, first hit. */
function firstCrossing(seg: Seg, box: Box): Point | null {
  for (const edge of boxEdges(box)) {
    const hit = segmentCross(seg, edge);
    if (hit !== null) return hit;
  }
  return null;
}

function distancePointSegment([px, py]: Point, [[ax, ay], [bx, by]]: Seg): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Shortest distance from a box's outline to a segment; 0 when they touch. */
export function distanceBoxSegment(box: Box, seg: Seg): number {
  if (firstCrossing(seg, box) !== null) return 0;
  const toCorners = boxCorners(box).map((c) => distancePointSegment(c, seg));
  const toEnds = seg.map(([x, y]) => Math.hypot(Math.max(box.x0 - x, 0, x - box.x1), Math.max(box.y0 - y, 0, y - box.y1)));
  return Math.min(...toCorners, ...toEnds);
}

export const round1 = (n: number): number => Math.round(n * 10) / 10;

export function boundsOf(poly: readonly Point[]): Box {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

const signedArea = (poly: readonly Point[]): number => ringSignedArea(poly);

/**
 * The outline pushed outward by `mm`, corners mitred (a sharp corner is capped at 3 x the distance so it cannot
 * spike). An approximation for convex and gently curved panel outlines; it does not resolve self-overlap on a tight
 * concave notch.
 */
export function offsetOutline(poly: readonly Point[], mm: number): Point[] {
  const out = signedArea(poly) > 0 ? 1 : -1; // which side is outside depends on winding
  const n = poly.length;
  return poly.map((p, i) => {
    const prev = poly[(i + n - 1) % n] as Point;
    const next = poly[(i + 1) % n] as Point;
    const norm = (a: Point, b: Point): Point => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return [(out * (b[1] - a[1])) / len, (out * -(b[0] - a[0])) / len];
    };
    const n1 = norm(prev, p);
    const n2 = norm(p, next);
    const sx = n1[0] + n2[0];
    const sy = n1[1] + n2[1];
    const sl2 = sx * sx + sy * sy;
    if (sl2 < 1e-9) return [p[0] + n1[0] * mm, p[1] + n1[1] * mm];
    const scale = Math.min((2 * mm) / sl2, 3 * mm / Math.sqrt(sl2));
    return [p[0] + sx * scale, p[1] + sy * scale];
  });
}
