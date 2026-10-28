import sharp from "sharp";
import { createHash } from "node:crypto";

/** A picture as pixels, ready to place: RGBA 8 bit, written to PNG, resampled once. */
interface Prepared {
  readonly png: Uint8Array;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly imageId: string;
  /** Pixels across in the file as read, before resampling. */
  readonly sourceWidthPx: number;
}

/** Most pixels read from one picture. Intake caps files lower; this guards the print path on its own. */
const MAX_SOURCE_PIXELS = 100_000_000;

/**
 * Reads the print copy and resamples it ONCE to the resolution it will print at, never up: a picture with fewer
 * pixels than the print resolution needs is kept as it is, and its real dpi is reported by the caller.
 * Never reads a screen copy.
 */
export async function preparePicture(bytes: Uint8Array, printedWidthMm: number, dpi: number): Promise<Prepared | null> {
  try {
    const image = sharp(bytes, { limitInputPixels: MAX_SOURCE_PIXELS });
    const meta = await image.metadata();
    if (!meta.width || !meta.height) return null;
    const wanted = Math.max(1, Math.round((printedWidthMm / 25.4) * dpi));
    const resize = wanted < meta.width;
    const pipeline = image.ensureAlpha().toColourspace("srgb");
    const { data, info } = await (resize ? pipeline.resize({ width: wanted, kernel: "lanczos3" }) : pipeline).raw().toBuffer({ resolveWithObject: true });
    const png = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png({ compressionLevel: 6 }).toBuffer();
    const imageId = createHash("sha256").update(png).digest("hex").slice(0, 16);
    return { png: new Uint8Array(png), widthPx: info.width, heightPx: info.height, imageId, sourceWidthPx: meta.width };
  } catch {
    return null;
  }
}

export const PICTURE_REFUSED = "A picture could not be read, so it was left off.";
