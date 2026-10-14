import type { PieceLine, Point } from "@/lib/production/contract";

export type Bounds = Readonly<{
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}>;

/** The smallest upright box round some points, in millimetres. */
export function boundsOf(points: readonly Point[]): Bounds {
  if (points.length === 0) throw new RangeError("A piece needs at least one point.");
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

function reflect(point: Point, fold: PieceLine): Point {
  const [ax, ay] = fold.from;
  const dx = fold.to[0] - ax;
  const dy = fold.to[1] - ay;
  const t = ((point[0] - ax) * dx + (point[1] - ay) * dy) / (dx * dx + dy * dy);
  const footX = ax + t * dx;
  const footY = ay + t * dy;
  return [2 * footX - point[0], 2 * footY - point[1]];
}

/**
 * The whole piece as it lies when the fabric is opened out. A piece cut on a fold is drawn as
 * one half; the other half is its mirror image across the fold line. Walking the half forward and
 * then its mirror backward keeps one closed loop.
 */
export function openedOutline(outline: readonly Point[], fold: PieceLine | null): Point[] {
  if (fold === null) return outline.map((p): Point => [p[0], p[1]]);
  if (fold.from[0] === fold.to[0] && fold.from[1] === fold.to[1]) {
    throw new RangeError("A fold line needs two different points.");
  }
  const mirrored = outline.map((p) => reflect(p, fold)).reverse();
  return [...outline.map((p): Point => [p[0], p[1]]), ...mirrored];
}

/** The angle of a line from the x axis, from 0 up to but not including 180 degrees. */
export function grainAngleDeg(line: PieceLine): number {
  const degrees = (Math.atan2(line.to[1] - line.from[1], line.to[0] - line.from[0]) * 180) / Math.PI;
  return ((degrees % 180) + 180) % 180;
}

export function rotateAll(points: readonly Point[], radians: number): Point[] {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return points.map(([x, y]): Point => [x * cos - y * sin, x * sin + y * cos]);
}
