/**
 * "Clubs can start from their crest" (spec F-S9): the palette of an upload the brand already holds.
 *
 * The maths is the SHARED one, `lib/colour/palette.ts` — k-means in CIE Lab — so crest-to-kit (F-T2,
 * wave 3) reads the same crest the same way. This file only decodes the stored screen copy into
 * pixels and pairs each swatch with the sublimation estimate's answer.
 *
 * Nothing is saved here: the swatches are a suggestion the brand edits and then saves as a palette,
 * so a colour in a brand's palette is always one a person chose.
 */

import sharp from "sharp";
import { extractPalette, nearestSublimationSafe, type Swatch } from "@/lib/colour/palette";

/** What this needs of an upload: the `AssetReader` of `lib/artwork-stack`, narrowed. */
export interface CrestSource {
  readonly kind: "raster" | "vector";
  readScreenCopy: () => Promise<Uint8Array>;
}

export interface CrestSwatch extends Swatch {
  /** The nearest colour the sublimation estimate accepts. Equal to `hex` when it already is. */
  readonly safeHex: string;
  readonly inGamut: boolean;
  /** The sentence to show when the estimate refuses the colour, else null. */
  readonly warning: string | null;
}

/** How many colours a crest is read as, unless asked otherwise. Knitwright's own default. */
export const CREST_COLOURS = 5;

/** The widest the screen copy is read at. A crest's palette does not need more, and this keeps it quick. */
const READ_WIDTH = 256;

/**
 * The palette of one upload, dominant colour first, each with the estimate's answer. An upload with
 * nothing but transparent pixels has no palette, and this says so with an empty list rather than a guess.
 */
export async function crestPalette(source: CrestSource, colours: number = CREST_COLOURS): Promise<readonly CrestSwatch[]> {
  const bytes = await source.readScreenCopy();
  const { data, info } = await sharp(Buffer.from(bytes))
    .resize({ width: READ_WIDTH, height: READ_WIDTH, fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const palette = extractPalette({ width: info.width, height: info.height, data }, { colours });
  return palette.map((swatch) => {
    const match = nearestSublimationSafe(swatch.hex);
    return { ...swatch, safeHex: match.safeHex, inGamut: match.inGamut, warning: match.inGamut ? null : match.warning };
  });
}
