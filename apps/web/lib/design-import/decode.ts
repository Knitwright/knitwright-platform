import sharp from "sharp";
import { ANALYSIS_MAX_SIDE, type Raster } from "./raster";

/** The most pixels a picture may have before it is refused undecoded (a decompression bomb guard). 40 million, as for uploads. */
export const MAX_INPUT_PIXELS = 40_000_000;

export type Decoded = { readonly ok: true; readonly raster: Raster } | { readonly ok: false };

/** Decodes an uploaded picture to pixels for analysis, upright and no larger than the analysis size. Never throws. */
export async function decodeForAnalysis(bytes: Uint8Array): Promise<Decoded> {
  try {
    const { data, info } = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
      .rotate()
      .resize({ width: ANALYSIS_MAX_SIDE, height: ANALYSIS_MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return { ok: true, raster: { width: info.width, height: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) } };
  } catch {
    return { ok: false };
  }
}
