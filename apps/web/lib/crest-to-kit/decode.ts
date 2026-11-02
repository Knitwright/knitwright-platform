import "server-only";
import sharp from "sharp";
import type { Pixels } from "@/lib/colour/palette";
import type { CrestFile } from "./crest";

/**
 * The ONE place a crest's bytes are decoded, and it decodes them into a COPY.
 *
 * The crest itself is never touched: `sharp` is given the bytes to read, and what comes back is a
 * small raw buffer the palette counts colours in. The original array is not written to, resized or
 * re-encoded, which is what lets `crest.test.ts` hash it before the run and read the same bytes out
 * of every kit afterwards.
 *
 * It is the same two lines Brand Studio uses for a stored upload (`lib/brand-studio/crest.ts`,
 * decision 0079) and at the same width, so a crest read here and a crest read there give the same
 * colours. It lives apart from that one only because this side has the bytes in hand and that side
 * reads them out of storage.
 */

/** The widest the picture is read at. A crest's palette needs no more, and this keeps it quick. */
export const READ_WIDTH = 256;

/** Said where a file could not be decoded as a picture. The club is told what to send instead. */
export const CANNOT_DECODE =
  "That file could not be read as a picture. Export your crest again as a PNG, an SVG or a PDF, and try again. Nothing was stored.";

export type DecodeOutcome = Readonly<{ ok: true; pixels: Pixels }> | Readonly<{ ok: false; reason: string }>;

/** The pixels of a crest, or the reason it could not be read. A vector is rasterised to read it. */
export async function crestPixels(crest: CrestFile): Promise<DecodeOutcome> {
  try {
    const { data, info } = await sharp(Buffer.from(crest.bytes), { density: 150 })
      .resize({ width: READ_WIDTH, height: READ_WIDTH, fit: "inside", withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return { ok: true, pixels: { width: info.width, height: info.height, data } };
  } catch {
    return { ok: false, reason: CANNOT_DECODE };
  }
}

/** The pixel size of a raster crest, read from its header alone. Null when it could not be read. */
export async function crestSize(bytes: Uint8Array): Promise<Readonly<{ widthPx: number; heightPx: number }> | null> {
  try {
    const { width, height } = await sharp(Buffer.from(bytes)).metadata();
    return width === undefined || height === undefined ? null : { widthPx: width, heightPx: height };
  } catch {
    return null;
  }
}
