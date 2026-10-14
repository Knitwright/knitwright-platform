import type { StackColour } from "@/lib/artwork-stack";
import type { Raster } from "./raster";
import { toHex } from "./raster";
import { clamp01, round2 } from "./types";

/**
 * Step 6: cluster the garment's pixels (outside the marks) in Lab, merge near colours and keep up to 6 as
 * screen colours. No codes are guessed: a code is whatever a person types later. Shading, folds and light in
 * a photo are baked into the pixels, so a photo's colours are approximate.
 */

export type Lab = readonly [number, number, number];
export type Rgb = readonly [number, number, number];

export const MAX_GARMENT_COLOURS = 6;
/** Colours closer than this (CIE76 delta E) are one colour. */
export const MERGE_DELTA_E = 12;
/** A colour under this share of the garment is a fold, an edge or a speck, and is folded into its neighbour. */
export const MIN_SHARE = 0.015;

const linear = (c: number): number => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

export function rgbToLab([r, g, b]: Rgb): Lab {
  const [lr, lg, lb] = [linear(r), linear(g), linear(b)];
  const x = (0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb) / 0.95047;
  const y = 0.2126729 * lr + 0.7151522 * lg + 0.072175 * lb;
  const z = (0.0193339 * lr + 0.119192 * lg + 0.9503041 * lb) / 1.08883;
  const f = (t: number): number => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

export function labToRgb([l, a, b]: Lab): Rgb {
  const fy = (l + 16) / 116;
  const [fx, fz] = [fy + a / 500, fy - b / 200];
  const inv = (t: number): number => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));
  const [x, y, z] = [inv(fx) * 0.95047, inv(fy), inv(fz) * 1.08883];
  const lin = [3.2404542 * x - 1.5371385 * y - 0.4985314 * z, -0.969266 * x + 1.8760108 * y + 0.041556 * z, 0.0556434 * x - 0.2040259 * y + 1.0572252 * z];
  const gamma = (v: number): number => Math.round(255 * Math.min(1, Math.max(0, v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)));
  return [gamma(lin[0]), gamma(lin[1]), gamma(lin[2])];
}

export const deltaE = (a: Lab, b: Lab): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export interface Cluster {
  readonly lab: Lab;
  readonly rgb: Rgb;
  readonly hex: string;
  /** Share of the sampled garment pixels, 0 to 1. */
  readonly share: number;
}

const MAX_SAMPLES = 20_000;

function samplePixels(raster: Raster, mask: Uint8Array): Lab[] {
  const total = mask.reduce((n, v) => n + v, 0);
  const stride = Math.max(1, Math.floor(total / MAX_SAMPLES));
  const out: Lab[] = [];
  let seen = 0;
  for (let at = 0; at < mask.length; at += 1) {
    if (mask[at] !== 1) continue;
    if (seen % stride === 0) out.push(rgbToLab([raster.data[at * 4], raster.data[at * 4 + 1], raster.data[at * 4 + 2]]));
    seen += 1;
  }
  return out;
}

const mean = (points: readonly Lab[]): Lab => {
  const n = Math.max(1, points.length);
  return [points.reduce((s, p) => s + p[0], 0) / n, points.reduce((s, p) => s + p[1], 0) / n, points.reduce((s, p) => s + p[2], 0) / n];
};

/** Deterministic k-means: farthest-first seeds from the median pixel, ten rounds. */
function kmeans(points: readonly Lab[], k: number): { centres: Lab[]; counts: number[] } {
  const centres: Lab[] = [[...points].sort((a, b) => a[0] - b[0])[Math.floor(points.length / 2)]];
  while (centres.length < k) {
    const far = points.reduce((best, p) => {
      const d = Math.min(...centres.map((c) => deltaE(p, c)));
      return d > best.d ? { d, p } : best;
    }, { d: -1, p: points[0] });
    if (far.d < MERGE_DELTA_E) break;
    centres.push(far.p);
  }
  let counts = new Array<number>(centres.length).fill(0);
  for (let round = 0; round < 10; round += 1) {
    const groups: Lab[][] = centres.map(() => []);
    for (const p of points) {
      let best = 0;
      centres.forEach((c, i) => {
        if (deltaE(p, c) < deltaE(p, centres[best])) best = i;
      });
      groups[best].push(p);
    }
    groups.forEach((g, i) => {
      if (g.length > 0) centres[i] = mean(g);
    });
    counts = groups.map((g) => g.length);
  }
  return { centres, counts };
}

/** Clusters the garment pixels (mask 1) of a raster. Largest share first. Empty when there are no pixels. */
export function clusterColours(raster: Raster, mask: Uint8Array, max: number = MAX_GARMENT_COLOURS): Cluster[] {
  const points = samplePixels(raster, mask);
  if (points.length === 0) return [];
  const { centres, counts } = kmeans(points, Math.max(1, max));
  let groups = centres.map((lab, i) => ({ lab, n: counts[i] })).filter((g) => g.n > 0);
  const merge = (keep: (a: { lab: Lab; n: number }, b: { lab: Lab; n: number }) => boolean): void => {
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < groups.length && !changed; i += 1) {
        for (let j = i + 1; j < groups.length && !changed; j += 1) {
          if (!keep(groups[i], groups[j])) continue;
          const [a, b] = [groups[i], groups[j]];
          const n = a.n + b.n;
          const lab: Lab = [(a.lab[0] * a.n + b.lab[0] * b.n) / n, (a.lab[1] * a.n + b.lab[1] * b.n) / n, (a.lab[2] * a.n + b.lab[2] * b.n) / n];
          groups = [...groups.filter((_, at) => at !== i && at !== j), { lab, n }];
          changed = true;
        }
      }
    }
  };
  merge((a, b) => deltaE(a.lab, b.lab) < MERGE_DELTA_E);
  // Specks: fold into the nearest bigger colour by merging with it, whatever the distance.
  const total = groups.reduce((s, g) => s + g.n, 0);
  while (groups.length > 1) {
    const smallest = groups.reduce((s, g) => (g.n < s.n ? g : s));
    if (smallest.n / total >= MIN_SHARE) break;
    const nearest = groups.filter((g) => g !== smallest).reduce((s, g) => (deltaE(g.lab, smallest.lab) < deltaE(s.lab, smallest.lab) ? g : s));
    merge((a, b) => (a === smallest && b === nearest) || (a === nearest && b === smallest));
  }
  return groups
    .sort((a, b) => b.n - a.n || a.lab[0] - b.lab[0])
    .slice(0, max)
    .map((g) => {
      const rgb = labToRgb(g.lab);
      return { lab: g.lab, rgb, hex: toHex(rgb), share: round2(g.n / total) };
    });
}

const ROLES = ["Ground", "Second colour", "Third colour", "Fourth colour", "Fifth colour", "Sixth colour", "Ink", "Second ink", "Third ink"];

/** The clusters as the stack's colour list: screen colours only, read from the picture, no codes. */
export function toStackColours(clusters: readonly Cluster[], offset = 0): StackColour[] {
  return clusters.map((cluster, at) => ({
    id: `colour-${offset + at + 1}`,
    role: ROLES[offset + at] ?? `Colour ${offset + at + 1}`,
    screen: cluster.hex,
    codes: [],
    provenance: "read-from-image" as const,
  }));
}

/** How sure the colours are: lower for a photo (shading is baked in) and for many close colours. */
export function colourConfidence(clusters: readonly Cluster[], photo: boolean): number {
  if (clusters.length === 0) return 0;
  return round2(clamp01((photo ? 0.6 : 0.9) - Math.max(0, clusters.length - 4) * 0.05));
}
