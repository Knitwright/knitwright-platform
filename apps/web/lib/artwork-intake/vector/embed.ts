import sharp from "sharp";
import { INTAKE_LIMITS, VECTOR_LIMITS } from "../settings";
import type { VectorModel } from "./model";
import { modelToSvg } from "./to-svg";

const EMBEDDED_EDGE_PX = 4096;
const EMBEDDED_PIXELS = 16_000_000;

/**
 * A picture inside an SVG, read again as pixels: the type comes from its bytes, the pixel count is capped
 * before decoding, and only a clean PNG of the pixels is kept. Null when it cannot be read or is too big.
 */
export const reencodeEmbedded = async (bytes: Uint8Array): Promise<string | null> => {
  if (bytes.byteLength === 0 || bytes.byteLength > VECTOR_LIMITS.maxEmbeddedImageBytes) return null;
  try {
    const meta = await sharp(bytes, { limitInputPixels: false }).metadata();
    if (!meta.width || !meta.height || meta.width * meta.height > EMBEDDED_PIXELS) return null;
    if (meta.format !== "png" && meta.format !== "jpeg") return null;
    const png = await sharp(bytes, { limitInputPixels: EMBEDDED_PIXELS, failOn: "error" })
      .rotate()
      .resize({ width: EMBEDDED_EDGE_PX, height: EMBEDDED_EDGE_PX, fit: "inside", withoutEnlargement: true })
      .toColourspace("srgb")
      .png({ compressionLevel: 9 })
      .toBuffer();
    return png.byteLength > VECTOR_LIMITS.maxEmbeddedImageBytes ? null : png.toString("base64");
  } catch {
    return null;
  }
};

/** The size of the screen picture of a vector: the drawing's own shape, fitted inside the screen edge. */
export const previewSize = (model: VectorModel): { widthPx: number; heightPx: number } => {
  const { width, height } = model.viewBox;
  const scale = INTAKE_LIMITS.screenEdgePx / Math.max(width, height);
  return { widthPx: Math.max(1, Math.round(width * scale)), heightPx: Math.max(1, Math.round(height * scale)) };
};

/** A PNG of the model, with a see-through background. Built from the model only, so nothing outside can load. */
export const renderPreview = async (model: VectorModel): Promise<{ png: Buffer; widthPx: number; heightPx: number }> => {
  const size = previewSize(model);
  const png = await sharp(Buffer.from(modelToSvg(model, size)), { limitInputPixels: INTAKE_LIMITS.screenEdgePx ** 2 * 2 })
    .png({ compressionLevel: 9 })
    .toBuffer();
  return { png, ...size };
};
