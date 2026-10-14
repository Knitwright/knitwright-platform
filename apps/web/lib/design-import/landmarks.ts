import type { LandmarkId } from "@/lib/production/contract";
import type { ViewId } from "@/lib/artwork-stack";
import type { Bounds } from "./outline";
import { clamp01, type LandmarkSet, type Pt } from "./types";

/**
 * Finds a body's landmarks from its mask, by plain geometry: the neck dip at the centre, the neck's top edge,
 * where the sleeve steepens, where the width falls to the body's, and the hem. Sleeved and sleeveless shapes
 * give different certainty; each landmark carries its own.
 */

export interface FoundLandmarks {
  readonly points: LandmarkSet;
  /** 0 to 1 for each landmark found. */
  readonly confidence: Readonly<Partial<Record<LandmarkId, number>>>;
  readonly notes: readonly string[];
}

interface Mask {
  readonly data: Uint8Array;
  readonly width: number;
  readonly bbox: Bounds;
}

const on = (mask: Mask, x: number, y: number): boolean => mask.data[y * mask.width + x] === 1;

function rowExtent(mask: Mask, y: number): { left: number; right: number } | null {
  let left = -1;
  let right = -1;
  for (let x = mask.bbox.minX; x <= mask.bbox.maxX; x += 1) {
    if (!on(mask, x, y)) continue;
    if (left === -1) left = x;
    right = x;
  }
  return left === -1 ? null : { left, right };
}

function topAt(mask: Mask, x: number): number | null {
  for (let y = mask.bbox.minY; y <= mask.bbox.maxY; y += 1) if (on(mask, x, y)) return y;
  return null;
}

const median = (values: readonly number[]): number => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

interface Body {
  readonly centre: number;
  readonly width: number;
  /** The right side seam as a line x = from + slope * y, fitted to the rows below any sleeve. */
  readonly sideAt: (y: number) => number;
}

/** The body's side and centre, read from the rows between 55 % and 90 % of the height (below any sleeve). */
function bodyColumn(mask: Mask): Body {
  const { minY, maxY } = mask.bbox;
  const height = maxY - minY;
  const rows: { y: number; left: number; right: number }[] = [];
  for (let y = Math.round(minY + height * 0.55); y <= Math.round(minY + height * 0.9); y += 1) {
    const extent = rowExtent(mask, y);
    if (extent) rows.push({ y, ...extent });
  }
  const n = rows.length;
  const [my, mx] = [rows.reduce((s, r) => s + r.y, 0) / n, rows.reduce((s, r) => s + r.right, 0) / n];
  const varY = rows.reduce((s, r) => s + (r.y - my) ** 2, 0);
  const slope = varY === 0 ? 0 : rows.reduce((s, r) => s + (r.y - my) * (r.right - mx), 0) / varY;
  return {
    centre: median(rows.map((r) => (r.left + r.right) / 2)),
    width: median(rows.map((r) => r.right - r.left)),
    sideAt: (y) => mx + slope * (y - my),
  };
}

/**
 * Where the sleeve's lower edge meets the body's side: moving out from the side, the first column whose run of garment
 * from the top ends high up AND outside the line of the body's side, so it is the underside of a sleeve and not the
 * side seam leaning away. Reading along the fitted side line copes with a photo's perspective.
 */
function underarmPoint(mask: Mask, body: Body): Pt | null {
  const { minY, maxY } = mask.bbox;
  const side = Math.round(body.centre + body.width / 2);
  const reach = Math.max(3, Math.round(body.width * 0.2));
  for (let probe = side - 4; probe <= side + reach; probe += 1) {
    const top = topAt(mask, probe);
    if (top === null) return null;
    let bottom = top;
    while (bottom + 1 <= maxY && on(mask, probe, bottom + 1)) bottom += 1;
    if (bottom <= minY + (maxY - minY) * 0.6 && probe > body.sideAt(bottom) + 1.5) return { x: probe, y: bottom };
  }
  return null;
}

/** The first column right of the neck where the top edge steepens: where the shoulder line meets the sleeve. */
function shoulderPoint(mask: Mask, hps: Pt, limitX: number): Pt | null {
  const tops: Pt[] = [];
  for (let x = Math.round(hps.x); x <= limitX; x += 1) {
    const y = topAt(mask, x);
    if (y !== null) tops.push({ x, y });
  }
  const span = 10;
  if (tops.length < span * 3) return null;
  const slope = (i: number): number => (tops[Math.min(tops.length - 1, i + span)].y - tops[i].y) / (tops[Math.min(tops.length - 1, i + span)].x - tops[i].x || 1);
  const first = slope(span);
  for (let i = span * 2; i < tops.length - span; i += 1) if (slope(i) - first > 0.25) return tops[i];
  return null;
}

/** The two body views. Sleeves and collars are not fitted in this version (decision 0034: body only). */
export function findBodyLandmarks(mask: Mask, view: ViewId): FoundLandmarks {
  const notes: string[] = [];
  const points: Partial<Record<LandmarkId, Pt>> = {};
  const confidence: Partial<Record<LandmarkId, number>> = {};
  const set = (id: LandmarkId, point: Pt, sure: number): void => {
    points[id] = point;
    confidence[id] = clamp01(sure);
  };
  const { minY, maxY, minX, maxX } = mask.bbox;
  const height = maxY - minY;
  const body = bodyColumn(mask);
  const centre = Math.round(body.centre);
  const neckId: LandmarkId = view === "back" ? "cb-neck" : "cf-neck";
  const hemId: LandmarkId = view === "back" ? "cb-hem" : "cf-hem";

  const neckTop = topAt(mask, centre);
  if (neckTop !== null) {
    const dip = (neckTop - minY) / height;
    set(neckId, { x: centre, y: neckTop }, dip > 0.04 ? 0.9 : 0.5);
    if (dip <= 0.04) notes.push("The neckline is hard to see, so the neck point is approximate.");
  }
  const edge = Math.round(minY + Math.max(2, height * 0.008));
  let hps: Pt | null = null;
  for (let step = 1; step <= (maxX - minX) / 2 && hps === null; step += 1) {
    const y = topAt(mask, centre + step);
    if (y !== null && y <= edge) hps = { x: centre + step, y };
  }
  if (hps !== null) set("hps", hps, 0.85);

  const found = underarmPoint(mask, body);
  const sleeved = found !== null;
  const underarmY = found?.y ?? Math.round(minY + height * 0.28);
  const extent = rowExtent(mask, underarmY);
  if (found) set("underarm", found, 0.85);
  else if (extent) set("underarm", { x: extent.right, y: underarmY }, 0.35);
  if (!sleeved) notes.push("No sleeves were found, so the underarm is a rough place.");

  if (hps !== null && extent) {
    const shoulder = shoulderPoint(mask, hps, extent.right + Math.round(body.width * 0.4));
    if (shoulder !== null) set("shoulder-point", shoulder, 0.7);
    else {
      const x = Math.round(hps.x + (extent.right - hps.x) * 0.95);
      const y = topAt(mask, x);
      if (y !== null) set("shoulder-point", { x, y }, 0.4);
    }
  }

  const bottom = rowExtent(mask, maxY - 1);
  if (bottom) {
    set(hemId, { x: Math.round((bottom.left + bottom.right) / 2), y: maxY }, 0.9);
    set("side-hem", { x: bottom.right, y: maxY }, 0.8);
  }
  return { points, confidence, notes };
}
