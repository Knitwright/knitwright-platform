import sharp from "sharp";
import { AppError } from "@/lib/server/core/errors";
import { createArtworkAssetReader } from "./asset-reader";
import { withConversionSlot } from "./gate";
import { intakeArtwork, type IntakeWho } from "./intake";
import { ARTWORK_LIMITS } from "./limits";
import { getArtworkRow, type ArtworkSummary } from "./records";
import {
  findRepeat, makeSeamless, measureSeam, readPixels, repeatImage, SEAMLESS_LIMIT, writePng, type RepeatFound, type SeamReport, type SeamlessMethod,
} from "./tile";
import { removeWhiteBox } from "./white-box";


/**
 * Things done to an artwork that already exists: take the white box off a logo, look at a tile's repeat,
 * make a tile seamless. Each reads the brand's own print copy, and any new picture is stored as a new
 * artwork that remembers where it came from, so the original is never changed.
 */

export const NOT_A_PICTURE = "This is a vector, not a picture. It has no white background or repeat to work on here.";
export const TOO_BIG_FOR_CLEAN_UP = "This picture is too large to clean up here. Remove the white background in your design app, then upload it again.";

/** The size a tile is looked at and previewed. */
const CHECK_EDGE = 1024;
/** The size a seamless tile is made at. */
const MAKE_EDGE = 4096;
const PREVIEW_EDGE = 900;

async function printCopy(who: IntakeWho, artworkId: string) {
  const row = await getArtworkRow(who.admin, who.brandId, artworkId);
  if (row.kind !== "raster") throw new AppError("invalid_input", NOT_A_PICTURE);
  const asset = await createArtworkAssetReader(who.admin, who.brandId).getAsset(artworkId);
  if (!asset) throw new AppError("not_found", "That artwork does not exist.");
  return { row, bytes: await asset.readPrintCopy() };
}

const png = (image: Parameters<typeof writePng>[0]): Promise<Buffer> => writePng(image);

/** Makes the white that touches the border see-through, as a new artwork. */
export async function removeWhiteBackground(who: IntakeWho, artworkId: string): Promise<ArtworkSummary> {
  const { row, bytes } = await printCopy(who, artworkId);
  if (row.width_px * row.height_px > ARTWORK_LIMITS.maxRemoveWhitePixels) throw new AppError("too_large", TOO_BIG_FOR_CLEAN_UP);
  const pixels = await readPixels(bytes, ARTWORK_LIMITS.maxEdge, ARTWORK_LIMITS.maxPixels);
  return intakeArtwork(who, { bytes: await png(removeWhiteBox(pixels)), filename: `${row.name} no white`, derivedFrom: row.id });
}

export type TileCheck = Readonly<{ seam: SeamReport; repeat: RepeatFound; previewPng: string }>;

const base64 = (bytes: Buffer): string => bytes.toString("base64");

/** Measures how well a picture repeats, and shows it laid out 3 x 3. */
export const checkTile = (who: IntakeWho, artworkId: string): Promise<TileCheck> =>
  withConversionSlot(who.brandId, () => checkTileNow(who, artworkId));

async function checkTileNow(who: IntakeWho, artworkId: string): Promise<TileCheck> {
  const { bytes } = await printCopy(who, artworkId);
  const pixels = await readPixels(bytes, CHECK_EDGE, ARTWORK_LIMITS.maxPixels);
  const small = await readPixels(await png(pixels), 256, ARTWORK_LIMITS.maxPixels);
  return {
    seam: measureSeam(pixels),
    repeat: findRepeat(small),
    previewPng: base64(await writePng(repeatImage(await readPixels(await png(pixels), PREVIEW_EDGE / 3, ARTWORK_LIMITS.maxPixels), 3))),
  };
}

export type SeamlessPreview = Readonly<{ before: SeamReport; after: SeamReport; method: SeamlessMethod; limit: string; previewPng: string }>;

/** What making a tile seamless would do: the mismatch before and after, and the result laid out 3 x 3. Nothing is saved. */
export const previewSeamless = (who: IntakeWho, artworkId: string, method: SeamlessMethod): Promise<SeamlessPreview> =>
  withConversionSlot(who.brandId, () => previewSeamlessNow(who, artworkId, method));

async function previewSeamlessNow(who: IntakeWho, artworkId: string, method: SeamlessMethod): Promise<SeamlessPreview> {
  const { bytes } = await printCopy(who, artworkId);
  const pixels = await readPixels(bytes, CHECK_EDGE, ARTWORK_LIMITS.maxPixels);
  const made = makeSeamless(pixels, method);
  const grid = repeatImage(await readPixels(await png(made), Math.floor(PREVIEW_EDGE / 3), ARTWORK_LIMITS.maxPixels), 3);
  return { before: measureSeam(pixels), after: measureSeam(made), method, limit: SEAMLESS_LIMIT, previewPng: base64(await writePng(grid)) };
}

/** Makes the tile seamless and stores the result as a new artwork. */
export async function saveSeamless(who: IntakeWho, artworkId: string, method: SeamlessMethod): Promise<ArtworkSummary> {
  const { row, bytes } = await printCopy(who, artworkId);
  const pixels = await readPixels(bytes, MAKE_EDGE, ARTWORK_LIMITS.maxPixels);
  const made = makeSeamless(pixels, method);
  const asPng = await sharp(made.data, { raw: { width: made.width, height: made.height, channels: 4 } }).png().toBuffer();
  return intakeArtwork(who, { bytes: asPng, filename: `${row.name} seamless`, derivedFrom: row.id });
}
