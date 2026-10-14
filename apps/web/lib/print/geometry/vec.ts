import type { Point } from "@/lib/production/contract";

export type Pt = Point;
export interface Box {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** Millimetres at 0.01 mm, the precision files are written at. Never negative zero. */
export const round2 = (value: number): number => Math.round((value + Number.EPSILON * Math.sign(value)) * 100) / 100 + 0;
export const roundPt = (p: Pt): Pt => [round2(p[0]), round2(p[1])];

export const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
export const mul = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k];
export const dot = (a: Pt, b: Pt): number => a[0] * b[0] + a[1] * b[1];
export const length = (a: Pt): number => Math.hypot(a[0], a[1]);
export const distance = (a: Pt, b: Pt): number => length(sub(a, b));

export function unit(a: Pt): Pt {
  const l = length(a);
  if (l === 0) throw new RangeError("A zero length vector has no direction.");
  return [a[0] / l, a[1] / l];
}

/** Rotates counter-clockwise (in a y-up plane) by degrees. */
export function rotateBy(a: Pt, degrees: number): Pt {
  const r = (degrees * Math.PI) / 180;
  const [c, s] = [Math.cos(r), Math.sin(r)];
  return [a[0] * c - a[1] * s, a[0] * s + a[1] * c];
}

export function boundsOf(points: readonly Pt[]): Box {
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/** Positive when the points run counter-clockwise in a y-up plane. */
export function signedArea(points: readonly Pt[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}
export const polygonArea = (points: readonly Pt[]): number => Math.abs(signedArea(points));

export function centroid(points: readonly Pt[]): Pt {
  const b = boundsOf(points);
  return [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2];
}

export function pointInPolygon(p: Pt, polygon: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Reflects a point across the infinite line through a and b. */
export function mirrorAcross(p: Pt, a: Pt, b: Pt): Pt {
  const d = unit(sub(b, a));
  const rel = sub(p, a);
  const along = dot(rel, d);
  const foot = add(a, mul(d, along));
  return sub(mul(foot, 2), p);
}

export const rect = (minX: number, minY: number, maxX: number, maxY: number): Pt[] => [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]];
export const boxPolygon = (b: Box): Pt[] => rect(b.minX, b.minY, b.maxX, b.maxY);
export const growBox = (b: Box, by: number): Box => ({ minX: b.minX - by, minY: b.minY - by, maxX: b.maxX + by, maxY: b.maxY + by });
export const boxesOverlap = (a: Box, b: Box): boolean => a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
