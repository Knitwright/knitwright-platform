import type { Pixels } from "@/lib/colour/palette";
import { fromLch, labToHex, toLch } from "@/lib/colour/convert";
import { CLUB_PALETTE } from "@/lib/kit-styles/presets";
import type { CrestFile } from "../crest";

/**
 * The hundred-crest test set of spec F-T2's acceptance ("95% of a 100-crest test set yields kits
 * whose primary colour matches the crest's dominant colour, ΔE00 < 5").
 *
 * EVERY CREST HERE IS GENERATED. No club's crest, no third party's artwork and no downloaded file
 * is committed to this repository, ever. Each fixture is drawn from arithmetic: a shield of one
 * colour, a band of a second and a charge of a third, over a transparent surround, with the areas
 * chosen so the dominant colour is the one a club would call its own.
 *
 * The colours come from the platform's own club palette (`lib/kit-styles/presets.ts`), each turned
 * about the hue circle and lightened or darkened by a fixed step, so the set covers the range of
 * colours a club actually wears rather than a hundred random pixels. The generator is pure and
 * seeded by the index, so the set is identical on every machine and in every run.
 */

/** A pixel buffer the shared palette can read. Straight RGBA bytes, row by row. */
const BLANK_ALPHA = 0;

export interface CrestFixture {
  readonly id: string;
  readonly name: string;
  /** The three colours drawn, dominant first. These are what a test measures against. */
  readonly colours: readonly [string, string, string];
  readonly pixels: Pixels;
}

const EDGE = 48;

const byteOf = (hex: string, at: number): number => Number.parseInt(hex.slice(1 + at * 2, 3 + at * 2), 16);

/** A colour turned `degrees` about the hue circle and moved `lightness` in CIE Lab. */
function shifted(hex: string, degrees: number, lightness: number): string {
  const { l, c, h } = toLch(hex);
  const moved = Math.min(96, Math.max(6, l + lightness));
  return labToHex(fromLch(moved, c, (h + degrees + 360) % 360));
}

/**
 * The three colours of one fixture: three different colours of the club palette, each turned a
 * little about the hue circle and lightened or darkened. Three palette entries rather than three
 * shifts of one, so a crest in an achromatic colour — black, white or grey, which a turn about the
 * hue circle cannot change — still reads as three colours, as a real crest in those colours does.
 */
export function fixtureColours(index: number): readonly [string, string, string] {
  const size = CLUB_PALETTE.length;
  const entry = (step: number): string => CLUB_PALETTE[(index + step) % size]!.swatch;
  const dominant = shifted(entry(0), ((index * 37) % 9) - 4, (((index * 13) % 5) - 2) * 6);
  const second = shifted(entry(5), ((index * 23) % 11) - 5, (((index * 7) % 7) - 3) * 5);
  const third = shifted(entry(9), ((index * 17) % 13) - 6, (((index * 11) % 5) - 2) * 7);
  return [dominant, second, third];
}

/**
 * One crest as pixels: a rounded shield in the dominant colour, a band across it in the second, and
 * a square charge in the third. The shares are fixed by the shapes, so the dominant colour is
 * always the largest, which is what the acceptance test measures.
 */
export function crestPixels(index: number): Pixels {
  const [dominant, second, third] = fixtureColours(index);
  const data = new Uint8Array(EDGE * EDGE * 4);
  const bandTop = 30;
  const bandBottom = 37;
  const chargeFrom = 18;
  const chargeTo = 29;
  for (let y = 0; y < EDGE; y += 1) {
    for (let x = 0; x < EDGE; x += 1) {
      const at = (y * EDGE + x) * 4;
      // A shield: the full width at the top, tapering to a point at the bottom.
      const inset = y < EDGE * 0.6 ? 4 : 4 + Math.round((y - EDGE * 0.6) * 1.4);
      const inside = x >= inset && x < EDGE - inset && y >= 3 && y < EDGE - 3;
      if (!inside) {
        data[at + 3] = BLANK_ALPHA;
        continue;
      }
      const inBand = y >= bandTop && y < bandBottom;
      const inCharge = y >= chargeFrom && y < chargeTo && x >= chargeFrom && x < chargeTo;
      const hex = inCharge ? third : inBand ? second : dominant;
      data[at] = byteOf(hex, 0);
      data[at + 1] = byteOf(hex, 1);
      data[at + 2] = byteOf(hex, 2);
      data[at + 3] = 255;
    }
  }
  return { width: EDGE, height: EDGE, data };
}

/** How many crests the set holds. The specification's own number. */
export const FIXTURE_COUNT = 100;

export const crestFixture = (index: number): CrestFixture => ({
  id: `crest-${String(index + 1).padStart(3, "0")}`,
  name: `Generated crest ${index + 1}`,
  colours: fixtureColours(index),
  pixels: crestPixels(index),
});

/** The whole set, in order. Generated on every call: nothing is kept between tests. */
export const crestFixtures = (count: number = FIXTURE_COUNT): readonly CrestFixture[] =>
  Array.from({ length: count }, (_, index) => crestFixture(index));

/**
 * A crest file whose bytes sniff as a PNG and are otherwise arbitrary. It exists for the
 * byte-for-byte test: nothing in this workstream decodes, resizes or re-encodes a crest's bytes, so
 * a buffer that merely starts like a PNG is enough to prove the bytes travel untouched, and no real
 * picture file has to be committed to prove it.
 */
export function crestFileFixture(index: number = 0, size = 512): CrestFile {
  const bytes = new Uint8Array(size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  for (let at = 8; at < size; at += 1) bytes[at] = (at * 31 + index * 7) % 256;
  return { name: `crest-${index}.png`, format: "png", kind: "raster", bytes, widthPx: 1200, heightPx: 1200 };
}

/** The same, as a drawing, which needs no print-quality check. */
export function crestSvgFixture(): CrestFile {
  const bytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#1b2a49"/></svg>');
  return { name: "crest.svg", format: "svg", kind: "vector", bytes, widthPx: null, heightPx: null };
}
