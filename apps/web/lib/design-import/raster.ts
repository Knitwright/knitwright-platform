import sharp from "sharp";

/** A decoded picture: RGBA, 8 bits a channel, row after row. */
export interface Raster {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

/** The longest side of the analysis copy. The reading model gets the original; the maths gets this. */
export const ANALYSIS_SIDE = 480;
/** A decompression-bomb guard set before decoding. */
export const MAX_INPUT_PIXELS = 40_000_000;

export const RASTER_UNREADABLE = "That picture could not be opened. Use a PNG, JPEG or WebP image.";

/** Decodes bytes to the analysis copy: flattened on white, shrunk to fit, pixels only. Throws a plain sentence on failure. */
export async function decodeRaster(bytes: Uint8Array, side: number = ANALYSIS_SIDE): Promise<Raster> {
  try {
    const { data, info } = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .flatten({ background: "#ffffff" })
      .resize({ width: side, height: side, fit: "inside", withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return { width: info.width, height: info.height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength) };
  } catch (error) {
    throw new Error(RASTER_UNREADABLE, { cause: error });
  }
}

export async function encodePng(raster: Raster): Promise<Uint8Array> {
  const buffer = await sharp(Buffer.from(raster.data.buffer, raster.data.byteOffset, raster.data.byteLength), {
    raw: { width: raster.width, height: raster.height, channels: 4 },
  })
    .png()
    .toBuffer();
  return new Uint8Array(buffer);
}

export const pixelAt = (raster: Raster, x: number, y: number): readonly [number, number, number] => {
  const at = (Math.min(raster.height - 1, Math.max(0, Math.round(y))) * raster.width + Math.min(raster.width - 1, Math.max(0, Math.round(x)))) * 4;
  return [raster.data[at], raster.data[at + 1], raster.data[at + 2]];
};

export function blankRaster(width: number, height: number, rgb: readonly [number, number, number]): Raster {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let at = 0; at < data.length; at += 4) data.set([rgb[0], rgb[1], rgb[2], 255], at);
  return { width, height, data };
}

/** A copy with a rectangle (pixels) filled by one colour. The original is not changed. */
export function filledRect(raster: Raster, rect: { x0: number; y0: number; x1: number; y1: number }, rgb: readonly [number, number, number]): Raster {
  const data = new Uint8ClampedArray(raster.data);
  for (let y = Math.max(0, rect.y0); y < Math.min(raster.height, rect.y1); y += 1) {
    for (let x = Math.max(0, rect.x0); x < Math.min(raster.width, rect.x1); x += 1) data.set([rgb[0], rgb[1], rgb[2], 255], (y * raster.width + x) * 4);
  }
  return { width: raster.width, height: raster.height, data };
}

export const toHex = (rgb: readonly [number, number, number]): string =>
  `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
