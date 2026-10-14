import { crc32 } from "node:zlib";
import sharp from "sharp";

/** A PNG header that claims a size, with no picture data after it. The size is the only thing a reader checks first. */
export function pngHeaderClaiming(width: number, height: number): Uint8Array {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const chunk = (type: string, body: Buffer): Buffer => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(body.length);
    const checked = Buffer.concat([Buffer.from(type, "ascii"), body]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc32(checked));
    return Buffer.concat([length, checked, sum]);
  };
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IEND", Buffer.alloc(0))]);
}

/** A flat colour picture. */
export const solidPng = (width: number, height: number, background: string): Promise<Buffer> =>
  sharp({ create: { width, height, channels: 3, background } }).png().toBuffer();

/** A logo (a red disc) on a white box, as a PNG. */
export async function logoOnWhite(size = 120): Promise<Buffer> {
  const disc = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="100%" height="100%" fill="#fff"/><circle cx="${size / 2}" cy="${size / 2}" r="${size / 3}" fill="#c8102e"/><circle cx="${size / 2}" cy="${size / 2}" r="${size / 8}" fill="#fff"/></svg>`,
  );
  return sharp(disc).flatten({ background: "#ffffff" }).png().toBuffer();
}

/** A tile of vertical stripes of two colours whose left and right edges do not match (a seam). */
export async function seamyStripes(width = 64, height = 32): Promise<Buffer> {
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = (y * width + x) * 3;
      // A gradient from dark to light: the right edge is light, the left is dark, so the repeat shows a seam.
      const value = Math.round((x / (width - 1)) * 255);
      raw.set([value, 90, 255 - value], at);
    }
  }
  return sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

/** A tile that repeats exactly: a sine wave with a whole number of cycles across both directions. */
export async function seamlessWaves(width = 64, height = 64): Promise<Buffer> {
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const wave = Math.sin((2 * Math.PI * 2 * x) / width) + Math.cos((2 * Math.PI * 2 * y) / height);
      const v = Math.round(127.5 + (wave / 2) * 100);
      raw.set([v, 255 - v, 128], (y * width + x) * 3);
    }
  }
  return sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer();
}
