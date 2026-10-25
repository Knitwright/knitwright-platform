import type { Size } from "./frame";
import type { Rect } from "./types";

/** Every second pixel in each direction is sampled for colour: enough for a median, a quarter of the work. */
export const SAMPLE_STEP = 2;

/** A rectangle in reference pixels, moved to analysis pixels and clipped to the picture. Null if nothing is left. */
export function toAnalysis(rect: Rect, reference: Size, analysis: Size): Rect | null {
  const [sx, sy] = [analysis.width / reference.width, analysis.height / reference.height];
  const x0 = Math.max(0, Math.floor(rect.x * sx));
  const y0 = Math.max(0, Math.floor(rect.y * sy));
  const x1 = Math.min(analysis.width, Math.ceil((rect.x + rect.width) * sx));
  const y1 = Math.min(analysis.height, Math.ceil((rect.y + rect.height) * sy));
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : null;
}

/** Indices of the pixels inside `rect` where `allowed` is set, every `step` pixels. */
export function pixelsIn(rect: Rect, allowed: Uint8Array, width: number, step = 1): number[] {
  const found: number[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y += step) {
    for (let x = rect.x; x < rect.x + rect.width; x += step) {
      if (allowed[y * width + x]) found.push(y * width + x);
    }
  }
  return found;
}

/** A copy of `mask` with the given rectangles (grown by `margin` pixels) cleared. */
export function without(mask: Uint8Array, rects: readonly Rect[], size: Size, margin: number): Uint8Array {
  const out = Uint8Array.from(mask);
  for (const rect of rects) {
    const y1 = Math.min(size.height, rect.y + rect.height + margin);
    const x1 = Math.min(size.width, rect.x + rect.width + margin);
    for (let y = Math.max(0, rect.y - margin); y < y1; y++) for (let x = Math.max(0, rect.x - margin); x < x1; x++) out[y * size.width + x] = 0;
  }
  return out;
}
