import { crc32, deflateSync } from "node:zlib";
import sharp from "sharp";

/** Small pictures made on the spot, for tests. */

export const solid = async (width: number, height: number, background: string, format: "png" | "jpeg" | "tiff" = "png"): Promise<Buffer> => {
  const image = sharp({ create: { width, height, channels: 3, background } });
  return format === "png" ? image.png().toBuffer() : format === "jpeg" ? image.jpeg().toBuffer() : image.tiff().toBuffer();
};

/** A PNG with a header that claims a size and no picture data: it must be refused before anything is decoded. */
export const claimedPng = (width: number, height: number): Buffer => {
  const chunk = (type: string, data: Buffer): Buffer => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    // One row of data, nowhere near enough for the claimed size.
    chunk("IDAT", deflateSync(Buffer.alloc(8))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

/** A 600 dpi CMYK TIFF with the built-in CMYK profile embedded. */
export const cmykTiff = (width = 60, height = 40): Promise<Buffer> =>
  sharp({ create: { width, height, channels: 3, background: { r: 200, g: 30, b: 40 } } })
    .toColourspace("cmyk")
    .tiff({ compression: "lzw", xres: 600 / 25.4, yres: 600 / 25.4 })
    .withIccProfile("cmyk")
    .toBuffer();

/** A picture of `width` x `height` pixels that states `dpi`. */
export const withDpi = (width: number, height: number, dpi: number): Promise<Buffer> =>
  sharp({ create: { width, height, channels: 3, background: "#3366aa" } }).png().withMetadata({ density: dpi }).toBuffer();

/** A logo (red disc) on an opaque white box. */
export const logoOnWhite = async (size = 64): Promise<Buffer> => {
  const disc = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="100%" height="100%" fill="#fff"/><circle cx="${size / 2}" cy="${size / 2}" r="${size / 4}" fill="#c00"/></svg>`;
  return sharp(Buffer.from(disc)).png().toBuffer();
};

/** A tile with a smooth gradient across it, so opposite edges differ a lot: a repeat that shows a seam. */
export const gradientTile = (size = 64): Promise<Buffer> => {
  const raw = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const at = (y * size + x) * 3;
      raw[at] = Math.round((x / (size - 1)) * 255);
      raw[at + 1] = Math.round((y / (size - 1)) * 255);
      raw[at + 2] = 90;
    }
  }
  return sharp(raw, { raw: { width: size, height: size, channels: 3 } }).png().toBuffer();
};

/** A tile that repeats exactly: stripes with a period that divides the width. */
export const stripeTile = (size = 64, period = 16): Promise<Buffer> => {
  const raw = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const at = (y * size + x) * 3;
      const on = Math.floor(x / (period / 2)) % 2 === 0;
      raw[at] = on ? 220 : 20;
      raw[at + 1] = on ? 40 : 20;
      raw[at + 2] = on ? 40 : 160;
    }
  }
  return sharp(raw, { raw: { width: size, height: size, channels: 3 } }).png().toBuffer();
};
