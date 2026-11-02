/**
 * What the pictures a page points at turn out to be: their type, their size in pixels, and the
 * colours they are made of.
 *
 * The bytes are read, measured and **dropped**. `PictureFacts` holds numbers and `#rrggbb` strings
 * and cannot hold bytes, so a measured picture leaves nothing behind. When a person later accepts
 * one and ticks the rights box, `lib/brand-studio/import/apply.ts` asks for it once more and hands
 * it straight to `lib/storage/store.ts` as their own upload; that is the single exception the spec
 * allows, and it exists only behind the tick.
 *
 * The colours come from `lib/colour/palette.ts`, the same k-means in CIE Lab that Brand Studio's
 * crest palette and crest-to-kit use, so an imported picture and an uploaded one are read the same
 * way.
 */

import sharp from "sharp";
import { extractPalette } from "@/lib/colour/palette";
import { readPicture, type Fetcher } from "./fetch";
import type { BrandImportSettings } from "./settings";
import type { Candidate, PictureFacts } from "./types";

/** How wide a picture is read at before its colours are worked out. The same as the crest palette's. */
const READ_WIDTH = 256;

/** A picture smaller than this in either direction is a bullet or a spacer, not a brand's picture. */
export const SMALLEST_PICTURE_PX = 24;

/** What one read of one picture can say. A picture that could not be read says so and is left out. */
export type PictureOutcome = Readonly<{ ok: true; facts: PictureFacts }> | Readonly<{ ok: false; because: string }>;

/** The colours of one picture, dominant first. An empty or wholly transparent picture has none. */
async function swatchesOf(bytes: Uint8Array, colours: number): Promise<PictureFacts["swatches"]> {
  const { data, info } = await sharp(Buffer.from(bytes))
    .resize({ width: READ_WIDTH, height: READ_WIDTH, fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return extractPalette({ width: info.width, height: info.height, data }, { colours }).map((swatch) => ({
    hex: swatch.hex,
    share: Math.round(swatch.share * 1000) / 1000,
  }));
}

/** One picture's facts, from its bytes. The bytes are not returned and not kept. */
export async function factsOf(
  bytes: Uint8Array,
  contentType: string,
  from: Candidate,
  settings: BrandImportSettings,
): Promise<PictureOutcome> {
  try {
    const meta = await sharp(Buffer.from(bytes)).metadata();
    // `sharp` reports both sides of anything it could decode. A side it did not report fails the
    // size test below on its own, because `undefined >= 24` is false, so nothing is assumed here.
    const widthPx = meta.width as number;
    const heightPx = meta.height as number;
    if (!(widthPx >= SMALLEST_PICTURE_PX) || !(heightPx >= SMALLEST_PICTURE_PX)) {
      return { ok: false, because: "It is too small to be a logo or a photo." };
    }
    const swatches = await swatchesOf(bytes, settings.colours);
    return { ok: true, facts: { url: from.url, why: from.why, alt: from.alt, contentType, widthPx, heightPx, bytes: bytes.byteLength, swatches } };
  } catch {
    return { ok: false, because: "That picture could not be read." };
  }
}

/**
 * Reads the candidates **one at a time**, in the order the page offered them, stopping at the
 * allowance or at the deadline. One at a time is the point: a brand's site is not a load test.
 */
export async function readPictures(
  deps: Readonly<{ fetcher: Fetcher; settings: BrandImportSettings; before?: () => boolean }>,
  candidates: readonly Candidate[],
  most: number,
): Promise<readonly PictureFacts[]> {
  const found: PictureFacts[] = [];
  for (const one of candidates) {
    if (found.length >= most) break;
    if (deps.before && !deps.before()) break;
    const read = await readPicture(deps.fetcher, one.url, deps.settings);
    if (!read.ok) continue;
    const facts = await factsOf(read.bytes, read.contentType, one, deps.settings);
    if (facts.ok) found.push(facts.facts);
  }
  return found;
}

/**
 * How a picture is described on its row. It is defined in `items.ts` and re-exported here: this
 * file imports `sharp`, and the import screen is a client component that reaches `items.ts`
 * through the view model, so the words had to sit on the side of the seam a browser may load
 * (decision 0106).
 */
export { pictureDetail } from "./items";
