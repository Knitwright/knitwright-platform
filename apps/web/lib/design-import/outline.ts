import type { Raster } from "./raster";
import { clamp01, type Pt } from "./types";

/**
 * Step 3, classical first: the background is the colour of the region's corners, the garment is the largest
 * connected region that differs from it, holes inside are filled, and the contour is traced and simplified.
 * An image model clean-up is a separate, budgeted step (cleanup.ts) used only when this fails.
 */

export interface Rect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export type OutlineResult =
  | {
      readonly ok: true;
      /** 1 where the garment is, one byte for every pixel of the WHOLE raster. */
      readonly mask: Uint8Array;
      readonly polygon: readonly Pt[];
      readonly bbox: Bounds;
      readonly coverage: number;
      readonly confidence: number;
      readonly note: string;
    }
  | { readonly ok: false; readonly reason: string };

export const NO_OUTLINE =
  "The outline of the garment could not be found against the background. A plainer background, or a picture cleaned up by the image model, may help.";

const DIFFERENT = 40;

type Rgb = readonly [number, number, number];

function cornerColour(raster: Raster, rect: Rect): { colour: Rgb; spread: number } {
  const size = Math.max(2, Math.min(6, Math.floor((rect.x1 - rect.x0) / 10)));
  const samples: Rgb[] = [];
  for (const [cx, cy] of [[rect.x0, rect.y0], [rect.x1 - size, rect.y0], [rect.x0, rect.y1 - size], [rect.x1 - size, rect.y1 - size]]) {
    for (let y = cy; y < cy + size; y += 1) {
      for (let x = cx; x < cx + size; x += 1) {
        const at = (y * raster.width + x) * 4;
        samples.push([raster.data[at], raster.data[at + 1], raster.data[at + 2]]);
      }
    }
  }
  const median = (channel: 0 | 1 | 2): number => samples.map((s) => s[channel]).sort((a, b) => a - b)[Math.floor(samples.length / 2)];
  const colour: Rgb = [median(0), median(1), median(2)];
  const spread = samples.reduce((sum, s) => sum + distance(s, colour), 0) / samples.length;
  return { colour, spread };
}

const distance = (a: Rgb, b: Rgb): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Flood fill from the region's border over the background; whatever it cannot reach is inside the garment. */
function fillHoles(foreground: Uint8Array, raster: Raster, rect: Rect): Uint8Array {
  const { width } = raster;
  const reached = new Uint8Array(foreground.length);
  const stack: number[] = [];
  const push = (x: number, y: number): void => {
    const at = y * width + x;
    if (x < rect.x0 || x >= rect.x1 || y < rect.y0 || y >= rect.y1 || foreground[at] === 1 || reached[at] === 1) return;
    reached[at] = 1;
    stack.push(at);
  };
  for (let x = rect.x0; x < rect.x1; x += 1) {
    push(x, rect.y0);
    push(x, rect.y1 - 1);
  }
  for (let y = rect.y0; y < rect.y1; y += 1) {
    push(rect.x0, y);
    push(rect.x1 - 1, y);
  }
  while (stack.length > 0) {
    const at = stack.pop() as number;
    const [x, y] = [at % width, Math.floor(at / width)];
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  const out = new Uint8Array(foreground.length);
  for (let y = rect.y0; y < rect.y1; y += 1) for (let x = rect.x0; x < rect.x1; x += 1) out[y * width + x] = reached[y * width + x] === 1 ? 0 : 1;
  return out;
}

/** The biggest 4-connected region; every other pixel is cleared. */
function largestRegion(mask: Uint8Array, raster: Raster, rect: Rect): { mask: Uint8Array; size: number } {
  const { width } = raster;
  const seen = new Uint8Array(mask.length);
  let best: number[] = [];
  for (let y = rect.y0; y < rect.y1; y += 1) {
    for (let x = rect.x0; x < rect.x1; x += 1) {
      const start = y * width + x;
      if (mask[start] === 0 || seen[start] === 1) continue;
      const region: number[] = [];
      const stack = [start];
      seen[start] = 1;
      while (stack.length > 0) {
        const at = stack.pop() as number;
        region.push(at);
        const [px, py] = [at % width, Math.floor(at / width)];
        for (const [nx, ny] of [[px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]]) {
          const next = ny * width + nx;
          if (nx < rect.x0 || nx >= rect.x1 || ny < rect.y0 || ny >= rect.y1 || mask[next] === 0 || seen[next] === 1) continue;
          seen[next] = 1;
          stack.push(next);
        }
      }
      if (region.length > best.length) best = region;
    }
  }
  const out = new Uint8Array(mask.length);
  for (const at of best) out[at] = 1;
  return { mask: out, size: best.length };
}

const NEIGHBOURS: readonly (readonly [number, number])[] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

/** Moore-neighbour trace of the outer boundary, starting at the top-left-most pixel. */
function traceContour(mask: Uint8Array, width: number, height: number, bbox: Bounds): Pt[] {
  const on = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x] === 1;
  let startX = bbox.minX;
  while (!on(startX, bbox.minY)) startX += 1;
  const start: Pt = { x: startX, y: bbox.minY };
  const points: Pt[] = [start];
  let current = start;
  let direction = 6; // came from the left of the start, which is empty
  const limit = (bbox.maxX - bbox.minX + 1) * (bbox.maxY - bbox.minY + 1) * 4;
  for (let step = 0; step < limit; step += 1) {
    let moved = false;
    for (let turn = 0; turn < 8; turn += 1) {
      const d = (direction + 1 + turn) % 8;
      const [dx, dy] = NEIGHBOURS[d];
      if (on(current.x + dx, current.y + dy)) {
        current = { x: current.x + dx, y: current.y + dy };
        direction = (d + 4) % 8;
        moved = true;
        break;
      }
    }
    if (!moved || (current.x === start.x && current.y === start.y)) break;
    points.push(current);
  }
  return points;
}

const perpendicular = (p: Pt, a: Pt, b: Pt): number => {
  const [dx, dy] = [b.x - a.x, b.y - a.y];
  const length = Math.hypot(dx, dy);
  return length === 0 ? Math.hypot(p.x - a.x, p.y - a.y) : Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / length;
};

/** Douglas-Peucker on an open run. */
export function simplify(points: readonly Pt[], epsilon: number): Pt[] {
  if (points.length < 3) return [...points];
  let [worst, at] = [0, 0];
  for (let i = 1; i < points.length - 1; i += 1) {
    const d = perpendicular(points[i], points[0], points[points.length - 1]);
    if (d > worst) [worst, at] = [d, i];
  }
  if (worst <= epsilon) return [points[0], points[points.length - 1]];
  return [...simplify(points.slice(0, at + 1), epsilon).slice(0, -1), ...simplify(points.slice(at), epsilon)];
}

export function polygonArea(polygon: readonly Pt[]): number {
  let sum = 0;
  polygon.forEach((p, i) => {
    const q = polygon[(i + 1) % polygon.length];
    sum += p.x * q.y - q.x * p.y;
  });
  return Math.abs(sum) / 2;
}

export function pointInPolygon(point: Pt, polygon: readonly Pt[]): boolean {
  let inside = false;
  polygon.forEach((a, i) => {
    const b = polygon[(i + 1) % polygon.length];
    if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  });
  return inside;
}

/** Finds the garment inside `rect` (the whole picture, or one view's box). */
export function findOutline(raster: Raster, rect: Rect): OutlineResult {
  const { width } = raster;
  const { colour, spread } = cornerColour(raster, rect);
  const foreground = new Uint8Array(raster.data.length / 4);
  for (let y = rect.y0; y < rect.y1; y += 1) {
    for (let x = rect.x0; x < rect.x1; x += 1) {
      const at = (y * width + x) * 4;
      if (distance([raster.data[at], raster.data[at + 1], raster.data[at + 2]], colour) > DIFFERENT) foreground[y * width + x] = 1;
    }
  }
  const { mask: biggest, size } = largestRegion(fillHoles(foreground, raster, rect), raster, rect);
  const area = (rect.x1 - rect.x0) * (rect.y1 - rect.y0);
  const coverage = size / area;
  if (coverage < 0.03 || coverage > 0.92) return { ok: false, reason: NO_OUTLINE };
  const bbox = boundsOfMask(biggest, width, rect);
  const longest = Math.max(bbox.maxX - bbox.minX, bbox.maxY - bbox.minY);
  const polygon = simplify(traceContour(biggest, width, raster.height, bbox), Math.max(1, longest * 0.01));
  if (polygon.length < 3) return { ok: false, reason: NO_OUTLINE };
  const confidence = clamp01(0.95 - spread / 40 - (coverage > 0.8 ? 0.2 : 0));
  return {
    ok: true,
    mask: biggest,
    polygon,
    bbox,
    coverage,
    confidence,
    note: spread > 8 ? "The background is not plain, so the outline is less certain." : "The outline was found against a plain background.",
  };
}

function boundsOfMask(mask: Uint8Array, width: number, rect: Rect): Bounds {
  let b: Bounds = { minX: rect.x1, minY: rect.y1, maxX: rect.x0, maxY: rect.y0 };
  for (let y = rect.y0; y < rect.y1; y += 1) {
    for (let x = rect.x0; x < rect.x1; x += 1) {
      if (mask[y * width + x] === 1) b = { minX: Math.min(b.minX, x), minY: Math.min(b.minY, y), maxX: Math.max(b.maxX, x), maxY: Math.max(b.maxY, y) };
    }
  }
  return b;
}
