import type { DisplayList, DisplayShape } from "@/lib/artwork-stack/generator";
import type { Raster } from "../raster";

/**
 * Pictures as grids of palette numbers, so a flat and a drawn pattern are compared colour by colour, not shade by
 * shade. A pixel is "the third colour of the garment", whatever light fell on it. Pure and deterministic.
 */

export type Rgb = readonly [number, number, number];

/** Outside the garment, or a pixel nothing was read from. */
export const OUTSIDE = 255;

export interface Labels {
  readonly width: number;
  readonly height: number;
  /** A palette number for each pixel, row after row, or OUTSIDE. */
  readonly data: Uint8Array;
}

export interface Rect {
  readonly x0: number;
  readonly y0: number;
  /** Exclusive. */
  readonly x1: number;
  readonly y1: number;
}

/** Where a grid sits in design millimetres: pixel (i, j) is the point (originX + (i + 0.5) * step, originY + (j + 0.5) * step). */
export interface Frame {
  readonly originX: number;
  readonly originY: number;
  readonly step: number;
  readonly width: number;
  readonly height: number;
}

export const hexToRgb = (hex: string): Rgb => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

const distance2 = (a: Rgb, b: Rgb): number => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

export function nearest(palette: readonly Rgb[], colour: Rgb): number {
  let best = 0;
  for (let at = 1; at < palette.length; at += 1) if (distance2(palette[at], colour) < distance2(palette[best], colour)) best = at;
  return best;
}

const segmentDistance = (p: Rgb, a: Rgb, b: Rgb): number => {
  const d: Rgb = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const length2 = d[0] ** 2 + d[1] ** 2 + d[2] ** 2;
  const t = length2 === 0 ? 0 : Math.min(1, Math.max(0, ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1] + (p[2] - a[2]) * d[2]) / length2));
  return Math.sqrt(distance2(p, [a[0] + t * d[0], a[1] + t * d[1], a[2] + t * d[2]]));
};

/** A colour this near the line between two stronger colours is where they blend at an edge, not a colour of its own. */
export const BLEND_DISTANCE = 45;
/** A colour holding at least this share of the block is its own colour even when it lies between two others. */
export const OWN_SHARE = 0.15;

/**
 * Which palette colours are the garment's own: the first always, then in order of share any that is not a blend of
 * two already kept. Anti-aliased edges and soft light make blends, and a blend is never a colour a style is drawn in.
 */
export function ownColours(palette: readonly Rgb[], shares: readonly number[]): number[] {
  const order = palette.map((_, at) => at).filter((at) => at > 0).sort((a, b) => shares[b] - shares[a]);
  const kept = [0];
  for (const at of order) {
    const blend = shares[at] < OWN_SHARE && kept.some((a, i) => kept.slice(i).some((b) => segmentDistance(palette[at], palette[a], palette[b]) < BLEND_DISTANCE));
    if (!blend) kept.push(at);
  }
  return kept;
}

/** Each pixel of a flat that lies on the garment becomes the number of the nearest palette colour. */
export function classify(flat: Raster, mask: Uint8Array, palette: readonly Rgb[]): Labels {
  const data = new Uint8Array(flat.width * flat.height).fill(OUTSIDE);
  for (let at = 0; at < data.length; at += 1) {
    if (mask[at] === 0 || flat.data[at * 4 + 3] < 128) continue;
    data[at] = nearest(palette, [flat.data[at * 4], flat.data[at * 4 + 1], flat.data[at * 4 + 2]]);
  }
  return { width: flat.width, height: flat.height, data };
}

/**
 * The biggest block of garment found by growing a rectangle from the middle of the mask until every side is
 * blocked, then taking a margin off so edges and seams are not scored. Null when the block is too small to read.
 */
export function interiorRect(mask: Uint8Array, width: number, height: number, margin: number, least: number): Rect | null {
  let sx = 0;
  let sy = 0;
  let count = 0;
  for (let at = 0; at < mask.length; at += 1) {
    if (mask[at] === 0) continue;
    sx += at % width;
    sy += Math.floor(at / width);
    count += 1;
  }
  if (count === 0) return null;
  const centre = { x: Math.round(sx / count), y: Math.round(sy / count) };
  const seed = nearestInside(mask, width, height, centre);
  if (seed === null) return null;
  let rect: Rect = { x0: seed.x, y0: seed.y, x1: seed.x + 1, y1: seed.y + 1 };
  const lineFull = (x0: number, y0: number, x1: number, y1: number): boolean => {
    if (x0 < 0 || y0 < 0 || x1 > width || y1 > height) return false;
    for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) if (mask[y * width + x] === 0) return false;
    return true;
  };
  // Each move adds one row or column; only that new line is checked.
  const moves: readonly ((r: Rect) => Rect | null)[] = [
    (r) => (lineFull(r.x0 - 1, r.y0, r.x0, r.y1) ? { ...r, x0: r.x0 - 1 } : null),
    (r) => (lineFull(r.x1, r.y0, r.x1 + 1, r.y1) ? { ...r, x1: r.x1 + 1 } : null),
    (r) => (lineFull(r.x0, r.y0 - 1, r.x1, r.y0) ? { ...r, y0: r.y0 - 1 } : null),
    (r) => (lineFull(r.x0, r.y1, r.x1, r.y1 + 1) ? { ...r, y1: r.y1 + 1 } : null),
  ];
  for (let moved = true; moved; ) {
    moved = false;
    for (const move of moves) {
      const next = move(rect);
      if (next === null) continue;
      rect = next;
      moved = true;
    }
  }
  const inner = { x0: rect.x0 + margin, y0: rect.y0 + margin, x1: rect.x1 - margin, y1: rect.y1 - margin };
  return inner.x1 - inner.x0 >= least && inner.y1 - inner.y0 >= least ? inner : null;
}

function nearestInside(mask: Uint8Array, width: number, height: number, from: { x: number; y: number }): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (let at = 0; at < mask.length; at += 1) {
    if (mask[at] === 0) continue;
    const [x, y] = [at % width, Math.floor(at / width)];
    const d = (x - from.x) ** 2 + (y - from.y) ** 2;
    if (d < bestD) {
      best = { x, y };
      bestD = d;
    }
  }
  return best;
}

/** The pixels of a flat inside a rectangle, as colours. */
export function crop(flat: Raster, rect: Rect): Raster {
  const [width, height] = [rect.x1 - rect.x0, rect.y1 - rect.y0];
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) data.set(flat.data.subarray(((rect.y0 + y) * flat.width + rect.x0) * 4, ((rect.y0 + y) * flat.width + rect.x1) * 4), y * width * 4);
  return { width, height, data };
}

/** How many pixels in a rectangle take each palette number. */
export function profile(labels: Labels, rect: Rect, colours: number): number[] {
  const counts = new Array<number>(colours).fill(0);
  for (let y = rect.y0; y < rect.y1; y += 1) {
    for (let x = rect.x0; x < rect.x1; x += 1) {
      const here = labels.data[y * labels.width + x];
      if (here < colours) counts[here] += 1;
    }
  }
  return counts;
}

/** The pixels above, below and beside one, left out where they fall outside a rectangle. */
function neighboursIn(at: number, width: number, rect: Rect): number[] {
  const [ax, ay] = [at % width, Math.floor(at / width)];
  return [[ax - 1, ay], [ax + 1, ay], [ax, ay - 1], [ax, ay + 1]]
    .filter(([nx, ny]) => nx >= rect.x0 && nx < rect.x1 && ny >= rect.y0 && ny < rect.y1)
    .map(([nx, ny]) => ny * width + nx);
}

/** How many pixels of one colour join the pixel `start`, marking each as seen. */
function patchSize(labels: Labels, rect: Rect, seen: Uint8Array, start: number): number {
  const colour = labels.data[start];
  const stack = [start];
  let size = 0;
  while (stack.length > 0) {
    const at = stack.pop() as number;
    size += 1;
    for (const next of neighboursIn(at, labels.width, rect)) {
      if (seen[next] === 1 || labels.data[next] !== colour) continue;
      seen[next] = 1;
      stack.push(next);
    }
  }
  return size;
}

/** How many separate patches of one colour, of at least `least` pixels, a rectangle holds. Plain blocks of colour have a few; a pattern has many. */
export function regionCount(labels: Labels, rect: Rect, least: number): number {
  const seen = new Uint8Array(labels.width * labels.height);
  let regions = 0;
  for (let y = rect.y0; y < rect.y1; y += 1) {
    for (let x = rect.x0; x < rect.x1; x += 1) {
      const start = y * labels.width + x;
      if (seen[start] === 1) continue;
      seen[start] = 1;
      if (patchSize(labels, rect, seen, start) >= least) regions += 1;
    }
  }
  return regions;
}

function fillRow(row: Uint8Array, from: number, to: number, value: number): void {
  for (let i = Math.max(0, from); i <= Math.min(row.length - 1, to); i += 1) row[i] = value;
}

function drawCircle(frame: Frame, data: Uint8Array, shape: Extract<DisplayShape, { kind: "circle" }>, value: number): void {
  const { originX, originY, step, width, height } = frame;
  const r2 = shape.radius ** 2;
  const [j0, j1] = [Math.floor((shape.centre.y - shape.radius - originY) / step - 0.5), Math.ceil((shape.centre.y + shape.radius - originY) / step - 0.5)];
  for (let j = Math.max(0, j0); j <= Math.min(height - 1, j1); j += 1) {
    const dy = originY + (j + 0.5) * step - shape.centre.y;
    const half = r2 - dy * dy;
    if (half < 0) continue;
    const reach = Math.sqrt(half);
    const [i0, i1] = [Math.ceil((shape.centre.x - reach - originX) / step - 0.5), Math.floor((shape.centre.x + reach - originX) / step - 0.5)];
    fillRow(data.subarray(j * width, (j + 1) * width), i0, i1, value);
  }
}

function drawPolygon(frame: Frame, data: Uint8Array, shape: Extract<DisplayShape, { kind: "polygon" }>, value: number): void {
  const { originX, originY, step, width, height } = frame;
  const points = shape.points;
  if (points.length < 3) return;
  const [low, high] = [Math.min(...points.map((p) => p.y)), Math.max(...points.map((p) => p.y))];
  const [j0, j1] = [Math.max(0, Math.floor((low - originY) / step - 0.5)), Math.min(height - 1, Math.ceil((high - originY) / step - 0.5))];
  for (let j = j0; j <= j1; j += 1) {
    const y = originY + (j + 0.5) * step;
    const crossings: number[] = [];
    for (let at = 0; at < points.length; at += 1) {
      const [a, b] = [points[at], points[(at + 1) % points.length]];
      if (a.y > y !== b.y > y) crossings.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
    }
    crossings.sort((p, q) => p - q);
    for (let c = 0; c + 1 < crossings.length; c += 2) {
      fillRow(data.subarray(j * width, (j + 1) * width), Math.ceil((crossings[c] - originX) / step - 0.5), Math.floor((crossings[c + 1] - originX) / step - 0.5), value);
    }
  }
}

/** A generator's display list as palette numbers over a frame, on a ground of palette number `ground`. First shape first. */
export function rasterise(list: DisplayList, frame: Frame, palette: readonly Rgb[], ground: number): Labels {
  const data = new Uint8Array(frame.width * frame.height).fill(ground);
  const numbers = new Map<string, number>();
  const numberOf = (fill: string): number => {
    const known = numbers.get(fill);
    if (known !== undefined) return known;
    const made = nearest(palette, hexToRgb(fill));
    numbers.set(fill, made);
    return made;
  };
  for (const shape of list.shapes) {
    if (shape.kind === "circle") drawCircle(frame, data, shape, numberOf(shape.fill));
    else drawPolygon(frame, data, shape, numberOf(shape.fill));
  }
  return { width: frame.width, height: frame.height, data };
}
