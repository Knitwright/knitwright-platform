import type { Box, Ring } from "../scene";
import type { Pt } from "./affine";

/** Millimetres kept to 0.01 mm, the precision files are written at. */
export const round2 = (value: number): number => Math.round(value * 100) / 100 + 0;

export function boundsOf(points: readonly Pt[]): Box {
  if (points.length === 0) throw new RangeError("A shape needs at least one point.");
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

export const boxRing = (box: Box): Ring => [
  [box.minX, box.minY],
  [box.maxX, box.minY],
  [box.maxX, box.maxY],
  [box.minX, box.maxY],
];

export const growBox = (box: Box, by: number): Box => ({ minX: box.minX - by, minY: box.minY - by, maxX: box.maxX + by, maxY: box.maxY + by });

export const boxesOverlap = (a: Box, b: Box): boolean => a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;

/** Positive when the points run counter-clockwise in a y-up plane. */
export function signedArea(ring: readonly Pt[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const [x1, y1] = ring[i] as Pt;
    const [x2, y2] = ring[(i + 1) % ring.length] as Pt;
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

/** `signedArea` for points written as `{ x, y }`. */
export const signedAreaXY = (points: readonly { readonly x: number; readonly y: number }[]): number => signedArea(points.map((p): Pt => [p.x, p.y]));

export const areaOf = (ring: readonly Pt[]): number => Math.abs(signedArea(ring));

/** Even-odd test. A point exactly on the edge counts as inside. */
export function pointInRing(point: Pt, ring: readonly Pt[]): boolean {
  const [px, py] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i] as Pt;
    const [xj, yj] = ring[j] as Pt;
    if (onSegment(point, [xi, yi], [xj, yj])) return true;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function onSegment([px, py]: Pt, [ax, ay]: Pt, [bx, by]: Pt): boolean {
  const cross = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  if (Math.abs(cross) > 1e-9) return false;
  return px >= Math.min(ax, bx) - 1e-9 && px <= Math.max(ax, bx) + 1e-9 && py >= Math.min(ay, by) - 1e-9 && py <= Math.max(ay, by) + 1e-9;
}

/** True when every point of `inner` lies inside `outer`. */
export const ringWithin = (inner: readonly Pt[], outer: readonly Pt[]): boolean => inner.every((point) => pointInRing(point, outer));

/** A rectangle `width` by `height` centred on the origin, turned by `radians` and moved to `centre`. */
export function turnedRect(centre: Pt, width: number, height: number, radians: number): Ring {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const corner = (x: number, y: number): Pt => [centre[0] + x * cos - y * sin, centre[1] + x * sin + y * cos];
  const [hw, hh] = [width / 2, height / 2];
  return [corner(-hw, -hh), corner(hw, -hh), corner(hw, hh), corner(-hw, hh)];
}

/** A circle as a regular polygon: 64 corners keeps the error of a 15 mm radius under 0.02 mm. */
export function circleRing(centre: Pt, radius: number, corners = 64): Ring {
  return Array.from({ length: corners }, (_, i): Pt => {
    const angle = (2 * Math.PI * i) / corners;
    return [centre[0] + radius * Math.cos(angle), centre[1] + radius * Math.sin(angle)];
  });
}
