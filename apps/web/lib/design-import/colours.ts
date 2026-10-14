import type { Box } from "./geometry";
import type { Mask, Raster, Rgb } from "./raster";
import { toHex } from "./raster";
import { staged, type Staged } from "./types";

/**
 * The garment's colours (plan W7d step 6): garment pixels outside marks are grouped in Lab, near colours
 * are merged, and up to six come back as screen colours. No colour code is guessed: a code is whatever a
 * person types. Shading, folds and lighting in a photo are baked into what is read.
 */

export type Lab = readonly [number, number, number];

const WHITE: Rgb = [95.047, 100, 108.883];
const linear = (v: number): number => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const gamma = (c: number): number => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function labFromRgb(rgb: Rgb): Lab {
  const [r, g, b] = rgb.map(linear);
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) * 100;
  const y = (0.2126 * r + 0.7152 * g + 0.0722 * b) * 100;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) * 100;
  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(x / WHITE[0]), f(y / WHITE[1]), f(z / WHITE[2])];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function rgbFromLab(lab: Lab): Rgb {
  const fy = (lab[0] + 16) / 116;
  const fx = fy + lab[1] / 500;
  const fz = fy - lab[2] / 200;
  const inv = (t: number): number => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  const [x, y, z] = [inv(fx) * WHITE[0] / 100, inv(fy) * WHITE[1] / 100, inv(fz) * WHITE[2] / 100];
  const r = 3.2406 * x - 1.5372 * y - 0.4986 * z;
  const g = -0.9689 * x + 1.8758 * y + 0.0415 * z;
  const b = 0.0557 * x - 0.204 * y + 1.057 * z;
  return [gamma(r), gamma(g), gamma(b)].map((v) => Math.max(0, Math.min(255, Math.round(v)))) as unknown as Rgb;
}

/** How far apart two colours look: the plain Lab distance (CIE76). Below about 6 most people see one colour. */
export const deltaE = (a: Lab, b: Lab): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export interface FoundColour {
  readonly hex: string;
  /** The share of the garment's pixels (outside marks) this colour covers. */
  readonly share: number;
}

export interface ColourSource {
  readonly raster: Raster;
  readonly mask: Mask;
  /** Areas of the picture to leave out, such as a mark's box. */
  readonly exclude?: readonly Box[];
}

const MERGE_BELOW = 12;
const SPECK = 0.015;
const MAX_COLOURS = 6;
const MAX_SAMPLES = 40_000;

/** Pixels well inside the mask: the edge is blended with the background and would make a false colour. */
function samples(source: ColourSource): Rgb[] {
  const { raster, mask, exclude = [] } = source;
  const out: Rgb[] = [];
  const inside = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < mask.width && y < mask.height && mask.data[y * mask.width + x] === 1;
  for (let y = 0; y < raster.height; y += 1) {
    for (let x = 0; x < raster.width; x += 1) {
      if (!inside(x, y) || !inside(x - 2, y) || !inside(x + 2, y) || !inside(x, y - 2) || !inside(x, y + 2)) continue;
      if (exclude.some((box) => x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h)) continue;
      const at = (y * raster.width + x) * 4;
      out.push([raster.data[at], raster.data[at + 1], raster.data[at + 2]]);
    }
  }
  return out;
}

interface Cluster {
  lab: Lab;
  count: number;
}

/** Groups colours by their Lab bin, then merges bins that look alike, biggest first. The result does not depend on pixel order. */
function cluster(labs: readonly Lab[]): Cluster[] {
  const bins = new Map<string, { sum: [number, number, number]; count: number }>();
  for (const lab of labs) {
    const key = `${Math.round(lab[0] / 6)}:${Math.round(lab[1] / 6)}:${Math.round(lab[2] / 6)}`;
    const bin = bins.get(key) ?? { sum: [0, 0, 0], count: 0 };
    bin.sum[0] += lab[0];
    bin.sum[1] += lab[1];
    bin.sum[2] += lab[2];
    bin.count += 1;
    bins.set(key, bin);
  }
  const ordered = [...bins.entries()].sort((a, b) => b[1].count - a[1].count || (a[0] < b[0] ? -1 : 1)).map(([, bin]): Cluster => ({ lab: [bin.sum[0] / bin.count, bin.sum[1] / bin.count, bin.sum[2] / bin.count], count: bin.count }));
  const merged: Cluster[] = [];
  for (const next of ordered) {
    const near = merged.find((c) => deltaE(c.lab, next.lab) < MERGE_BELOW);
    if (near) near.count += next.count;
    else merged.push({ lab: next.lab, count: next.count });
  }
  return merged;
}

/** Up to six colours of the garment, biggest first. The confidence is lower when many colours blend into each other. */
export function dominantColours(sources: readonly ColourSource[]): Staged<readonly FoundColour[]> {
  const pixels = sources.flatMap(samples);
  if (pixels.length === 0) return staged([], 0, "No garment colours could be read.");
  const stride = Math.max(1, Math.ceil(pixels.length / MAX_SAMPLES));
  const labs = pixels.filter((_, i) => i % stride === 0).map(labFromRgb);
  const clusters = cluster(labs);
  const total = labs.length;
  const kept = clusters.filter((c) => c.count / total >= SPECK).slice(0, MAX_COLOURS);
  const keptTotal = kept.reduce((sum, c) => sum + c.count, 0);
  const found = kept.map((c): FoundColour => ({ hex: toHex(rgbFromLab(c.lab)), share: Math.round((c.count / keptTotal) * 1000) / 1000 }));
  const crisp = keptTotal / total;
  return staged(found, 0.5 + 0.45 * crisp, "Colours were read from the garment outside any marks. They are screen colours only: shading and lighting in the picture are part of them.");
}
