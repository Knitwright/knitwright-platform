import sharp from "sharp";

/** Raw 8-bit pixels, row after row. The tile checks and the white box tools work on these. */
export type Pixels = Readonly<{ data: Uint8Array; width: number; height: number; channels: 3 | 4 }>;

/** Decodes a picture to raw pixels, with the size already limited by the caller. */
export const toPixels = async (picture: Uint8Array, maxPixels: number): Promise<Pixels> => {
  const { data, info } = await sharp(picture, { limitInputPixels: maxPixels, failOn: "error" })
    .toColourspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength), width: info.width, height: info.height, channels: info.channels === 4 ? 4 : 3 };
};

export const toPng = (pixels: Pixels): Promise<Buffer> =>
  sharp(pixels.data, { raw: { width: pixels.width, height: pixels.height, channels: pixels.channels } })
    .png({ compressionLevel: 9 })
    .toBuffer();

/** The brightness of one pixel, 0 to 255. */
export const luma = (pixels: Pixels, index: number): number => {
  const at = index * pixels.channels;
  return 0.299 * pixels.data[at] + 0.587 * pixels.data[at + 1] + 0.114 * pixels.data[at + 2];
};
