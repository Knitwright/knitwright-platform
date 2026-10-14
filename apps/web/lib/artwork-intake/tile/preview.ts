import sharp from "sharp";
import type { Pixels } from "../raster/pixels";

/** The longest side of the 3 x 3 preview. */
const PREVIEW_EDGE = 1200;

/** The tile laid out 3 x 3, so a person sees the repeat and any seam before accepting a change. */
export const previewGrid = async (tile: Pixels, copies = 3): Promise<Buffer> => {
  const scale = Math.min(1, PREVIEW_EDGE / (Math.max(tile.width, tile.height) * copies));
  const width = Math.max(1, Math.round(tile.width * scale));
  const height = Math.max(1, Math.round(tile.height * scale));
  const one = await sharp(tile.data, { raw: { width: tile.width, height: tile.height, channels: tile.channels } })
    .resize(width, height, { kernel: "lanczos3" })
    .png()
    .toBuffer();
  const overlays = Array.from({ length: copies * copies }, (_, i) => ({
    input: one,
    left: (i % copies) * width,
    top: Math.floor(i / copies) * height,
  }));
  return sharp({ create: { width: width * copies, height: height * copies, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(overlays)
    .png({ compressionLevel: 9 })
    .toBuffer();
};
