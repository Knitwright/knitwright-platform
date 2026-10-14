import type { Point } from "@/lib/production/contract";

/** Plain geometry on millimetre points. Everything returns new values and none changes its input. */

export const dist = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

export const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
export const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1]];
export const scale = (a: Point, k: number): Point => [a[0] * k, a[1] * k];
export const dot = (a: Point, b: Point): number => a[0] * b[0] + a[1] * b[1];
export const cross = (a: Point, b: Point): number => a[0] * b[1] - a[1] * b[0];
export const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

export const unit = (a: Point): Point => {
  const length = Math.hypot(a[0], a[1]);
  return length === 0 ? [0, 0] : [a[0] / length, a[1] / length];
};

/** Rounds to the 0.01 mm the files are written at, by the number's exact value. Never returns minus zero. */
export const round2 = (n: number): number => Number(n.toFixed(2)) + 0;

export const roundPoint = (p: Point): Point => [round2(p[0]), round2(p[1])];

/** Signed area: positive when the points run anticlockwise. */
export function signedArea(outline: readonly Point[]): number {
  let sum = 0;
  for (let i = 0; i < outline.length; i += 1) {
    const [x1, y1] = outline[i];
    const [x2, y2] = outline[(i + 1) % outline.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

/** Length of an open run of points. */
export function runLength(points: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += dist(points[i - 1], points[i]);
  return total;
}

/**
 * The points of a closed outline from vertex `from` to vertex `to`, going forward and wrapping
 * round the end. When the two are the same vertex the run is the whole outline.
 */
export function slice(outline: readonly Point[], from: number, to: number): Point[] {
  const n = outline.length;
  const run: Point[] = [outline[from]];
  let i = from;
  do {
    i = (i + 1) % n;
    run.push(outline[i]);
  } while (i !== to);
  return run;
}

/** The index of the vertex nearest to `p`, with how far away it is. */
export function nearestVertex(outline: readonly Point[], p: Point): { index: number; distance: number } {
  let best = { index: 0, distance: Number.POSITIVE_INFINITY };
  outline.forEach((q, index) => {
    const distance = dist(q, p);
    if (distance < best.distance) best = { index, distance };
  });
  return best;
}

/** The point on a closed outline closest to `p`. */
export function nearestPointOnOutline(outline: readonly Point[], p: Point): { point: Point; distance: number } {
  let best: { point: Point; distance: number } = { point: outline[0], distance: Number.POSITIVE_INFINITY };
  for (let i = 0; i < outline.length; i += 1) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    const ab = sub(b, a);
    const lengthSquared = dot(ab, ab);
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, dot(sub(p, a), ab) / lengthSquared));
    const point = add(a, scale(ab, t));
    const distance = dist(point, p);
    if (distance < best.distance) best = { point, distance };
  }
  return best;
}

/** The point `distance` along an open run of points, clamped to the run. */
export function pointAlong(run: readonly Point[], distance: number): Point {
  let left = Math.max(0, distance);
  for (let i = 1; i < run.length; i += 1) {
    const step = dist(run[i - 1], run[i]);
    if (left <= step || i === run.length - 1) {
      const t = step === 0 ? 0 : Math.min(1, left / step);
      return add(run[i - 1], scale(sub(run[i], run[i - 1]), t));
    }
    left -= step;
  }
  return run[0];
}

const onSegment = (a: Point, b: Point, p: Point): boolean =>
  Math.min(a[0], b[0]) <= p[0] && p[0] <= Math.max(a[0], b[0]) && Math.min(a[1], b[1]) <= p[1] && p[1] <= Math.max(a[1], b[1]);

/** Whether two segments cross or touch. */
export function segmentsMeet(a: Point, b: Point, c: Point, d: Point): boolean {
  const d1 = cross(sub(b, a), sub(c, a));
  const d2 = cross(sub(b, a), sub(d, a));
  const d3 = cross(sub(d, c), sub(a, c));
  const d4 = cross(sub(d, c), sub(b, c));
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  return (d1 === 0 && onSegment(a, b, c)) || (d2 === 0 && onSegment(a, b, d)) || (d3 === 0 && onSegment(c, d, a)) || (d4 === 0 && onSegment(c, d, b));
}

/** The largest outline checked for crossing itself; a longer one is skipped, not guessed. */
export const SELF_CROSSING_LIMIT = 1500;

/** Whether a closed outline crosses itself. Neighbouring edges share an end and are not counted. */
export function crossesItself(outline: readonly Point[]): boolean {
  const n = outline.length;
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 2; j < n; j += 1) {
      if (i === 0 && j === n - 1) continue;
      if (segmentsMeet(outline[i], outline[(i + 1) % n], outline[j], outline[(j + 1) % n])) return true;
    }
  }
  return false;
}

/** The corner where two infinite lines meet, or null when they are parallel. */
export function lineMeet(p1: Point, d1: Point, p2: Point, d2: Point): Point | null {
  const denominator = cross(d1, d2);
  if (Math.abs(denominator) < 1e-9) return null;
  const t = cross(sub(p2, p1), d2) / denominator;
  return add(p1, scale(d1, t));
}
