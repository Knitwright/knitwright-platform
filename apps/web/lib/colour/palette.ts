/**
 * The palette of a picture, and the nearest colour a sublimation print is estimated to reach.
 *
 * SHARED, DELIBERATELY. Brand Studio (F-S9, plan v5 Y6) extracts a club's palette from its crest,
 * and crest-to-kit (F-T2, plan v5 Z6) does the same before it proposes kits. Both call
 * `extractPalette` here, so the two screens can never disagree about a crest's colours.
 *
 * The method is the spec's: k-means in CIE Lab, because Lab distance is closer to what an eye sees
 * than RGB distance. It is deterministic — same pixels in, same swatches out, every run — so a test
 * can pin it: the first centre is the most common colour, the rest come from k-means++ driven by one
 * seeded generator, and the loop stops when no pixel changes cluster or after `iterations` passes.
 *
 * Nothing here is a measurement. `nearestSublimationSafe` works against the ESTIMATED gamut of
 * `lib/guardrails/gamut.ts`, which has no ICC profile behind it; see `GAMUT_ESTIMATE_NOTE`.
 */

import { isInsideApproxGamut } from "@/lib/guardrails/gamut";
import { HEX, deltaE, fromLch, labToHex, toLab, toLch, type Lab } from "./convert";

export type { Lab };
export { labToHex, toLch };

/** Straight RGBA bytes, row by row, as an image decoder hands them over. */
export interface Pixels {
  readonly width: number;
  readonly height: number;
  /** `width * height * 4` bytes: red, green, blue, alpha. */
  readonly data: Uint8Array | Uint8ClampedArray | readonly number[];
}

/** One colour of a palette and how much of the picture it covers, 0 to 1. */
export interface Swatch {
  readonly hex: string;
  readonly share: number;
}

export interface PaletteOptions {
  /** How many colours to look for. Fewer are returned when the picture holds fewer. */
  readonly colours?: number;
  /** Pixels this transparent or more are ignored, so a crest's cut-out background is not a colour. */
  readonly minAlpha?: number;
  /** At most this many pixels are looked at, taken on an even stride. Keeps a 10 MB crest quick. */
  readonly sampleCap?: number;
  readonly iterations?: number;
}

/** Knitwright's own defaults, not anybody's measurement. */
export const PALETTE_DEFAULTS = { colours: 6, minAlpha: 128, sampleCap: 20_000, iterations: 24 } as const;

/** Said wherever a sublimation-safe colour is shown. The platform has no ICC profile for any print house. */
export const GAMUT_ESTIMATE_NOTE =
  "This is Knitwright's own estimate, not a colour match. The true range needs your print house's ICC profile, which Knitwright does not have.";

/** A whole-number generator with a fixed seed, so k-means++ picks the same centres every run. */
const generator = (seed: number) => {
  let state = seed >>> 0;
  return (): number => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
};

const square = (value: number): number => value * value;
const labGap = (a: Lab, b: Lab): number => square(a[0] - b[0]) + square(a[1] - b[1]) + square(a[2] - b[2]);

/**
 * The `#rrggbb` of one pixel, lower case. The caller has already read the pixel's alpha byte, which
 * is the last of its four, so the three colour bytes before it are certainly there.
 */
const hexAt = (data: Pixels["data"], at: number): string =>
  `#${[0, 1, 2].map((channel) => (data[at + channel] as number).toString(16).padStart(2, "0")).join("")}`;

/** Each colour of the picture with how many pixels hold it, in the order first met. Transparent pixels are left out. */
export function colourCounts(pixels: Pixels, options: PaletteOptions = {}): ReadonlyMap<string, number> {
  const { minAlpha, sampleCap } = { ...PALETTE_DEFAULTS, ...options };
  const total = Math.max(0, Math.floor(pixels.width) * Math.floor(pixels.height));
  const stride = total > sampleCap ? Math.ceil(total / sampleCap) : 1;
  const counts = new Map<string, number>();
  for (let index = 0; index < total; index += stride) {
    const at = index * 4;
    if ((pixels.data[at + 3] ?? 0) < minAlpha) continue;
    const hex = hexAt(pixels.data, at);
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  return counts;
}

type Point = Readonly<{ lab: Lab; weight: number }>;

/** The first centre is the commonest colour; each next one is drawn k-means++ style, weighted by distance. */
function seedCentres(points: readonly Point[], wanted: number): Lab[] {
  const random = generator(0x5eed_1a6b);
  const heaviest = points.reduce((best, point) => (point.weight > best.weight ? point : best), points[0]!);
  const centres: Lab[] = [heaviest.lab];
  while (centres.length < wanted) {
    const gaps = points.map((point) => point.weight * Math.min(...centres.map((centre) => labGap(point.lab, centre))));
    const sum = gaps.reduce((a, b) => a + b, 0);
    if (sum <= 0) break;
    let target = random() * sum;
    const chosen = points.findIndex((_, at) => (target -= gaps[at]!) <= 0);
    centres.push(points[chosen === -1 ? points.length - 1 : chosen]!.lab);
  }
  return centres;
}

/** The weighted mean of the points in each cluster. A cluster nobody joined keeps its old centre. */
const meansOf = (points: readonly Point[], of: readonly number[], centres: readonly Lab[]): Lab[] =>
  centres.map((centre, cluster) => {
    const mine = points.filter((_, at) => of[at] === cluster);
    const weight = mine.reduce((sum, point) => sum + point.weight, 0);
    if (weight === 0) return centre;
    const axis = (which: 0 | 1 | 2) => mine.reduce((sum, point) => sum + point.lab[which] * point.weight, 0) / weight;
    return [axis(0), axis(1), axis(2)] as Lab;
  });

const nearestCentre = (lab: Lab, centres: readonly Lab[]): number =>
  centres.reduce((best, centre, at) => (labGap(lab, centre) < labGap(lab, centres[best]!) ? at : best), 0);

/**
 * The palette of a picture: k-means in Lab over its colours, weighted by how many pixels hold each.
 * Ordered by share, largest first, so the first swatch is the dominant colour F-T2 matches against.
 * An empty or wholly transparent picture has no palette and gives an empty list.
 */
export function extractPalette(pixels: Pixels, options: PaletteOptions = {}): readonly Swatch[] {
  const { colours, iterations } = { ...PALETTE_DEFAULTS, ...options };
  const counts = colourCounts(pixels, options);
  if (counts.size === 0) return [];
  const points: readonly Point[] = [...counts].map(([hex, weight]) => ({ lab: toLab(hex), weight }));
  const seen = points.reduce((sum, point) => sum + point.weight, 0);
  let centres = seedCentres(points, Math.max(1, Math.min(Math.floor(colours), points.length)));
  let of = points.map((point) => nearestCentre(point.lab, centres));
  for (let pass = 0; pass < iterations; pass += 1) {
    centres = meansOf(points, of, centres);
    const next = points.map((point) => nearestCentre(point.lab, centres));
    if (next.every((cluster, at) => cluster === of[at])) break;
    of = next;
  }
  return centres
    .map((centre, cluster) => ({
      hex: labToHex(centre),
      share: points.reduce((sum, point, at) => (of[at] === cluster ? sum + point.weight : sum), 0) / seen,
    }))
    .filter((swatch) => swatch.share > 0)
    .sort((a, b) => b.share - a.share || a.hex.localeCompare(b.hex));
}

/** What the sublimation estimate says about one colour, and the nearest colour it says is reachable. */
export interface SublimationMatch {
  readonly hex: string;
  /** The nearest colour inside the estimated gamut. The same colour when it is already inside. */
  readonly safeHex: string;
  readonly inGamut: boolean;
  /** CIE76 difference between the colour and the safe one. 0 when nothing changed. */
  readonly deltaE: number;
  /** Shown beside the warning. Empty when there is no warning. */
  readonly warning: string;
}

/** How far the chroma is pulled in on each try. 100 steps from the colour to a plain grey. */
const CHROMA_STEP = 0.01;

/**
 * The nearest colour the sublimation estimate says a print can reach: the same lightness and hue,
 * with the chroma pulled in until the estimate accepts it. A colour already inside comes back
 * unchanged with no warning. Never a blocker, and never stated as a fact about any printer.
 */
export function nearestSublimationSafe(hex: string): SublimationMatch {
  if (!HEX.test(hex)) throw new RangeError("A colour must look like #1b2a49.");
  const colour = hex.toLowerCase();
  if (isInsideApproxGamut(colour)) return { hex: colour, safeHex: colour, inGamut: true, deltaE: 0, warning: "" };
  const { l, c, h } = toLch(colour);
  for (let pull = 1 - CHROMA_STEP; pull > 0; pull -= CHROMA_STEP) {
    const candidate = labToHex(fromLch(l, c * pull, h));
    if (!isInsideApproxGamut(candidate)) continue;
    return {
      hex: colour,
      safeHex: candidate,
      inGamut: false,
      deltaE: deltaE(colour, candidate),
      warning: `${colour} is more saturated than a sublimation print is estimated to reach, so it may print duller. The nearest estimated-safe colour is ${candidate}. ${GAMUT_ESTIMATE_NOTE}`,
    };
  }
  const grey = labToHex(fromLch(l, 0, h));
  return {
    hex: colour,
    safeHex: grey,
    inGamut: false,
    deltaE: deltaE(colour, grey),
    warning: `${colour} is more saturated than a sublimation print is estimated to reach, so it may print duller. ${GAMUT_ESTIMATE_NOTE}`,
  };
}
