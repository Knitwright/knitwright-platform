import type { Box } from "./geometry";

/** Pixels the analysis works on: 8 bits a channel, red green blue alpha, row by row. */
export interface Raster {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

/** One yes or no for each pixel. */
export interface Mask {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

export type Rgb = readonly [number, number, number];

/** The longest side the analysis uses. A larger picture is shrunk first; the outline is found on the shrunk one. */
export const ANALYSIS_MAX_SIDE = 1024;

export function createRaster(width: number, height: number, fill: readonly [number, number, number, number] = [255, 255, 255, 255]): Raster {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) data.set(fill, i * 4);
  return { width, height, data };
}

export const createMask = (width: number, height: number): Mask => ({ width, height, data: new Uint8Array(width * height) });

export function pixelAt(raster: Raster, x: number, y: number): readonly [number, number, number, number] {
  const at = (y * raster.width + x) * 4;
  return [raster.data[at], raster.data[at + 1], raster.data[at + 2], raster.data[at + 3]];
}

export const maskAt = (mask: Mask, x: number, y: number): boolean => x >= 0 && y >= 0 && x < mask.width && y < mask.height && mask.data[y * mask.width + x] === 1;

/** The part of a raster inside a box, clamped to the raster. */
export function cropRaster(raster: Raster, box: Box): { readonly raster: Raster; readonly x: number; readonly y: number } {
  const x = Math.max(0, Math.floor(box.x));
  const y = Math.max(0, Math.floor(box.y));
  const width = Math.max(1, Math.min(raster.width - x, Math.ceil(box.w)));
  const height = Math.max(1, Math.min(raster.height - y, Math.ceil(box.h)));
  const data = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    const from = ((y + row) * raster.width + x) * 4;
    data.set(raster.data.subarray(from, from + width * 4), row * width * 4);
  }
  return { raster: { width, height, data }, x, y };
}

export function cropMask(mask: Mask, box: Box): Mask {
  const x = Math.max(0, Math.floor(box.x));
  const y = Math.max(0, Math.floor(box.y));
  const width = Math.max(1, Math.min(mask.width - x, Math.ceil(box.w)));
  const height = Math.max(1, Math.min(mask.height - y, Math.ceil(box.h)));
  const data = new Uint8Array(width * height);
  for (let row = 0; row < height; row += 1) {
    const from = (y + row) * mask.width + x;
    data.set(mask.data.subarray(from, from + width), row * width);
  }
  return { width, height, data };
}

/** Colour distance in plain red green blue. Good enough to tell a garment from its background. */
export const rgbDistance = (a: Rgb, b: Rgb): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export const toHex = (rgb: Rgb): string => `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
