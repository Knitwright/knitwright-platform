import sharp from "sharp";
import type { ImageBytes } from "@/lib/flat/images";
import { IMAGE_LIMITS } from "./image";
import type { StoredBytes } from "./read";

/** The longest side, in pixels, of a picture put inside a drawing on the screen. */
export const DRAWING_EDGE = 320;

/** The most pixels a picture may have to be opened. It is the same limit as the upload check. */
export const MAX_INPUT_PIXELS = IMAGE_LIMITS.maxPixels;

/**
 * A copy of a stored picture with its longest side no more than `edge` pixels. The type is
 * kept. It never makes a picture larger. Bytes that are not a picture give null.
 */
export async function shrinkPicture(file: StoredBytes, edge: number, maxInputPixels: number = MAX_INPUT_PIXELS): Promise<ImageBytes | null> {
  try {
    const image = sharp(file.bytes, { limitInputPixels: maxInputPixels }).rotate().resize({
      width: edge,
      height: edge,
      fit: "inside",
      withoutEnlargement: true,
    });
    if (file.contentType === "image/png") return { bytes: new Uint8Array(await image.png().toBuffer()), contentType: "image/png" };
    return { bytes: new Uint8Array(await image.jpeg({ quality: 82 }).toBuffer()), contentType: "image/jpeg" };
  } catch {
    return null;
  }
}

/** A small copy of a stored picture for the screen drawing, so the page stays light. */
export const shrinkForDrawing = (file: StoredBytes, maxInputPixels: number = MAX_INPUT_PIXELS): Promise<ImageBytes | null> =>
  shrinkPicture(file, DRAWING_EDGE, maxInputPixels);
