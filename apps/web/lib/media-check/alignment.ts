import type { Frame } from "./frame";
import { dilate } from "./planes";

/** How far, in RGB distance, a pixel must sit from the background to count as garment. A setting, not a measurement. */
const FOREGROUND_DISTANCE = 32;
/** The reference mask is grown by this many analysis pixels before its outside is read as background. */
const BACKGROUND_GAP = 6;
/** Less background than this share of the canvas and the position cannot be measured. */
const MIN_BACKGROUND_SHARE = 0.02;
/** The background is fitted as a tilted plane (so a soft gradient is not garment), refitted without its outliers. */
const FIT_ROUNDS = 2;
const SAMPLE = 3;

/** Pixels of the canvas that lie outside the garment, away from its edge, sampled. Null if there are too few. */
function backgroundPixels(reference: Frame): number[] | null {
  const grown = dilate(reference.mask, reference.width, reference.height, BACKGROUND_GAP);
  const outside: number[] = [];
  let count = 0;
  for (let i = 0; i < grown.length; i++) {
    if (grown[i]) continue;
    if (count++ % SAMPLE === 0) outside.push(i);
  }
  return count >= MIN_BACKGROUND_SHARE * grown.length ? outside : null;
}

type Fit = readonly [number, number, number];

/** Least-squares plane c0 + c1*x + c2*y (x, y in 0..1) through the plane values at the pixels. */
function fitPlane(pixels: readonly number[], values: Float32Array, width: number, height: number): Fit {
  const m = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const v = [0, 0, 0];
  for (const i of pixels) {
    const f = [1, (i % width) / width, Math.floor(i / width) / height];
    for (let r = 0; r < 3; r++) {
      v[r] = (v[r] as number) + (f[r] as number) * (values[i] as number);
      for (let c = 0; c < 3; c++) m[r * 3 + c] = (m[r * 3 + c] as number) + (f[r] as number) * (f[c] as number);
    }
  }
  return solve3(m, v);
}

/** Solves a 3 by 3 system by Cramer's rule. A singular system answers with the mean value as a flat plane. */
function solve3(m: number[], v: number[]): Fit {
  const det = (a: number[]): number => a[0]! * (a[4]! * a[8]! - a[5]! * a[7]!) - a[1]! * (a[3]! * a[8]! - a[5]! * a[6]!) + a[2]! * (a[3]! * a[7]! - a[4]! * a[6]!);
  const d = det(m);
  if (Math.abs(d) < 1e-9) return [(v[0] as number) / Math.max(1, m[0] as number), 0, 0];
  const swap = (col: number): number[] => m.map((x, k) => (k % 3 === col ? (v[Math.floor(k / 3)] as number) : x));
  return [det(swap(0)) / d, det(swap(1)) / d, det(swap(2)) / d];
}

const valueAt = (fit: Fit, i: number, width: number, height: number): number => fit[0] + (fit[1] * (i % width)) / width + (fit[2] * Math.floor(i / width)) / height;

/** The garment of the generated picture: every pixel that is not the colour of the background around the garment. */
export function generatedMask(reference: Frame, generated: Frame, background: readonly number[]): Uint8Array {
  const { width, height } = generated;
  const planes = [generated.r, generated.g, generated.b];
  const limit = FOREGROUND_DISTANCE * FOREGROUND_DISTANCE;
  let fits = planes.map((p) => fitPlane(background, p, width, height));
  const gap = (i: number): number => {
    let sum = 0;
    for (let k = 0; k < 3; k++) sum += ((planes[k]![i] as number) - valueAt(fits[k]!, i, width, height)) ** 2;
    return sum;
  };
  for (let round = 1; round < FIT_ROUNDS; round++) {
    const keep = background.filter((i) => gap(i) <= limit);
    fits = planes.map((p) => fitPlane(keep, p, width, height));
  }
  const mask = new Uint8Array(reference.mask.length);
  for (let i = 0; i < mask.length; i++) mask[i] = gap(i) > limit ? 1 : 0;
  return mask;
}

/** Intersection over union of two masks. 0 when both are empty. */
export function overlap(a: Uint8Array, b: Uint8Array): number {
  let [both, either] = [0, 0];
  for (let i = 0; i < a.length; i++) {
    if (a[i] && b[i]) both++;
    if (a[i] || b[i]) either++;
  }
  return either === 0 ? 0 : both / either;
}

/**
 * How well the garment of the generated picture sits on the garment of the reference (0 to 1), or null when the
 * reference garment fills the canvas and there is no background to tell the garment from.
 */
export function alignment(reference: Frame, generated: Frame): number | null {
  const background = backgroundPixels(reference);
  return background ? overlap(reference.mask, generatedMask(reference, generated, background)) : null;
}
