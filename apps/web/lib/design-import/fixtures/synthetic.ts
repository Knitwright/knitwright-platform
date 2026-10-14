import type { LandmarkId } from "@/lib/production/contract";
import type { Pt } from "../geometry";
import { createRaster, type Raster, type Rgb } from "../raster";

/** Synthetic pictures made from known shapes, so the truth is known (plan W7d acceptance). */

export interface TeeShape {
  readonly cx: number;
  readonly top: number;
  readonly neckHalf: number;
  readonly neckDrop: number;
  readonly shoulderHalf: number;
  readonly shoulderDrop: number;
  readonly sleeveTop: Pt;
  readonly sleeveBottom: Pt;
  readonly bodyHalf: number;
  readonly underarmDrop: number;
  readonly hemDrop: number;
}

export const TEE: TeeShape = {
  cx: 320,
  top: 60,
  neckHalf: 45,
  neckDrop: 60,
  shoulderHalf: 130,
  shoulderDrop: 25,
  sleeveTop: { x: 230, y: 85 },
  sleeveBottom: { x: 180, y: 190 },
  bodyHalf: 110,
  underarmDrop: 120,
  hemDrop: 420,
};

/** The garment outline as a polygon, plus where its landmarks truly are (right side, and the centre). */
export function teeGeometry(shape: TeeShape = TEE): { polygon: Pt[]; truth: Partial<Record<LandmarkId, Pt>>; left: Partial<Record<LandmarkId, Pt>> } {
  const { cx, top } = shape;
  const mirror = (p: Pt): Pt => ({ x: 2 * cx - p.x, y: p.y });
  const right: Pt[] = [
    { x: cx + shape.neckHalf, y: top },
    { x: cx + shape.shoulderHalf, y: top + shape.shoulderDrop },
    { x: cx + shape.sleeveTop.x, y: top + shape.sleeveTop.y },
    { x: cx + shape.sleeveBottom.x, y: top + shape.sleeveBottom.y },
    { x: cx + shape.bodyHalf, y: top + shape.underarmDrop },
    { x: cx + shape.bodyHalf, y: top + shape.hemDrop },
  ];
  const neck: Pt[] = [
    { x: cx - shape.neckHalf, y: top },
    { x: cx - shape.neckHalf * 0.6, y: top + shape.neckDrop * 0.8 },
    { x: cx, y: top + shape.neckDrop },
    { x: cx + shape.neckHalf * 0.6, y: top + shape.neckDrop * 0.8 },
  ];
  const polygon = [...right, ...[...right].reverse().map(mirror), ...neck];
  const truth: Partial<Record<LandmarkId, Pt>> = {
    hps: right[0],
    "shoulder-point": right[1],
    underarm: right[4],
    "side-hem": right[5],
    "cf-neck": { x: cx, y: top + shape.neckDrop },
    "cf-hem": { x: cx, y: top + shape.hemDrop },
  };
  const left = Object.fromEntries(Object.entries(truth).map(([id, p]) => [id, mirror(p as Pt)])) as Partial<Record<LandmarkId, Pt>>;
  return { polygon, truth, left };
}

/** Fills a polygon (even-odd) with a colour. */
export function fillPolygon(raster: Raster, polygon: readonly Pt[], rgb: Rgb): void {
  for (let y = 0; y < raster.height; y += 1) {
    const crossings: number[] = [];
    polygon.forEach((a, i) => {
      const b = polygon[(i + 1) % polygon.length];
      if ((a.y <= y + 0.5 && b.y > y + 0.5) || (b.y <= y + 0.5 && a.y > y + 0.5)) {
        crossings.push(a.x + ((y + 0.5 - a.y) / (b.y - a.y)) * (b.x - a.x));
      }
    });
    crossings.sort((p, q) => p - q);
    for (let c = 0; c + 1 < crossings.length; c += 2) {
      for (let x = Math.max(0, Math.round(crossings[c])); x < Math.min(raster.width, Math.round(crossings[c + 1])); x += 1) {
        raster.data.set([rgb[0], rgb[1], rgb[2], 255], (y * raster.width + x) * 4);
      }
    }
  }
}

export function fillRect(raster: Raster, x: number, y: number, w: number, h: number, rgb: Rgb): void {
  fillPolygon(raster, [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }], rgb);
}

/** A picture of a tee on a plain background. */
export function teePicture(options: { garment: Rgb; background?: Rgb; width?: number; height?: number; shape?: TeeShape }): Raster {
  const raster = createRaster(options.width ?? 640, options.height ?? 520, [...(options.background ?? [255, 255, 255]), 255]);
  fillPolygon(raster, teeGeometry(options.shape).polygon, options.garment);
  return raster;
}

/** Draws `src` into a new raster through a map from new to old coordinates (nearest pixel). */
export function warpRaster(src: Raster, width: number, height: number, inverse: (p: Pt) => Pt, background: Rgb = [255, 255, 255]): Raster {
  const out = createRaster(width, height, [...background, 255]);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = inverse({ x, y });
      const sx = Math.round(p.x);
      const sy = Math.round(p.y);
      if (sx < 0 || sy < 0 || sx >= src.width || sy >= src.height) continue;
      const from = (sy * src.width + sx) * 4;
      out.data.set(src.data.subarray(from, from + 4), (y * width + x) * 4);
    }
  }
  return out;
}
