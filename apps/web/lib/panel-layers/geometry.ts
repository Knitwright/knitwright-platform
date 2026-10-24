import { roundMm } from "@/lib/artwork-stack";

/** Degrees into 0 up to, not including, 360, to 0.01. */
export function wrapDegrees(angle: number): number {
  const wrapped = roundMm(((angle % 360) + 360) % 360);
  return wrapped >= 360 ? 0 : wrapped;
}

export const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** True when two numbers are the same to rounding noise. */
export const same = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;

export interface Rect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/** The box that holds a rectangle of this size, centred on a point and turned by an angle. */
export function turnedBounds(centre: { x: number; y: number }, w: number, h: number, angleDeg: number): Rect {
  const a = (angleDeg * Math.PI) / 180;
  const halfW = (Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a))) / 2;
  const halfH = (Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a))) / 2;
  return { x0: centre.x - halfW, y0: centre.y - halfH, x1: centre.x + halfW, y1: centre.y + halfH };
}

/** The centre and size of the box that holds some points. */
export function frameOf(points: readonly (readonly [number, number])[]): { centre: { x: number; y: number }; size: { w: number; h: number } } {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return { centre: { x: roundMm((x0 + x1) / 2), y: roundMm((y0 + y1) / 2) }, size: { w: roundMm(x1 - x0), h: roundMm(y1 - y0) } };
}
