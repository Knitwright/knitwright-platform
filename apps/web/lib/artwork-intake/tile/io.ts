import sharp from "sharp";
import type { RgbaImage } from "../white-box";

/** Reads a stored picture as pixels, no larger than `maxEdge` on its longest side. */
export async function readPixels(bytes: Uint8Array, maxEdge: number, maxInputPixels: number): Promise<RgbaImage> {
  const { data, info } = await sharp(bytes, { limitInputPixels: maxInputPixels })
    .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength), width: info.width, height: info.height };
}

/** Pixels as a PNG, scaled down to fit `maxEdge` when asked. */
export async function writePng(image: RgbaImage, maxEdge?: number): Promise<Buffer> {
  const base = sharp(image.data, { raw: { width: image.width, height: image.height, channels: 4 } });
  const sized = maxEdge ? base.resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true }) : base;
  return sized.png({ compressionLevel: 9 }).toBuffer();
}
