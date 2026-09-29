import sharp from "sharp";
import type { ImageBytes } from "@/lib/flat/images";
import type { StoredBytes } from "./read";

/** The longest side, in pixels, of a picture put inside a drawing on the screen. */
export const DRAWING_EDGE = 320;

/**
 * A small copy of a stored picture for the screen drawing, so the page stays light. The
 * type is kept. It never makes a picture larger. Bytes that are not a picture give null.
 */
export async function shrinkForDrawing(file: StoredBytes): Promise<ImageBytes | null> {
  try {
    const image = sharp(file.bytes, { limitInputPixels: 40_000_000 }).rotate().resize({
      width: DRAWING_EDGE,
      height: DRAWING_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    });
    if (file.contentType === "image/png") return { bytes: new Uint8Array(await image.png().toBuffer()), contentType: "image/png" };
    return { bytes: new Uint8Array(await image.jpeg({ quality: 82 }).toBuffer()), contentType: "image/jpeg" };
  } catch {
    return null;
  }
}
