import sharp from "sharp";

/**
 * A 128-bit perceptual hash of a picture (decision 0073): flattened on white, turned grey, shrunk to 9 by 9, then each pixel
 * compared with the one to its right and with the one below it. Similar pictures (resized, recompressed, slightly recoloured)
 * give hashes a few bits apart; a different picture is tens of bits away.
 *
 * Two details are deliberate, and both were measured (`image.test.ts`):
 *
 * 1. **Both directions.** A one-direction difference hash compares neighbours along the row only, so a picture whose structure
 *    runs the other way (horizontal stripes) has no bit set at all and cannot be told from plain white. Comparing downwards as
 *    well as sideways fixes that, at the price of a longer hash.
 * 2. **A tie is a zero.** A plain difference hash asks "is the left pixel brighter?", which is a coin flip where two
 *    neighbours are equally bright, as they are across the flat background most artwork sits on. JPEG noise then flips those
 *    coins and moves the hash by 8 bits or more. A difference of `FLAT_TOLERANCE` or less counts as no edge, which held a
 *    re-saved JPEG of the test mark to 2 bits.
 *
 * It does not survive a crop, a mirror, a rotation, or a mark placed small inside a larger picture. Those need the vision
 * check (`vision.ts`), not this.
 */

/** A brightness difference this small (of 255) is not an edge. */
export const FLAT_TOLERANCE = 6;

/** The hash as text: 128 bits in 32 hex digits. */
export const IMAGE_HASH = /^[0-9a-f]{32}$/;

const SIDE = 9;

export async function imageHash(bytes: Uint8Array): Promise<string> {
  const { data } = await sharp(bytes)
    .flatten({ background: "#ffffff" })
    .greyscale()
    .resize(SIDE, SIDE, { fit: "fill", kernel: "lanczos3" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const at = (x: number, y: number): number => data[y * SIDE + x]!;
  const bits: number[] = [];
  for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) bits.push(at(x, y) - at(x + 1, y) > FLAT_TOLERANCE ? 1 : 0);
  for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) bits.push(at(x, y) - at(x, y + 1) > FLAT_TOLERANCE ? 1 : 0);
  // Written a nibble at a time: this project compiles to ES2017, which has no BigInt.
  let hex = "";
  for (let i = 0; i < bits.length; i += 4) {
    hex += ((bits[i]! << 3) | (bits[i + 1]! << 2) | (bits[i + 2]! << 1) | bits[i + 3]!).toString(16);
  }
  return hex;
}

/** How many bits are set in a nibble (0 to 15). */
const NIBBLE_BITS = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4] as const;

const check = (hash: string): void => {
  if (!IMAGE_HASH.test(hash)) throw new Error("An image hash is 32 hex digits.");
};

/** How many of the 128 bits differ. */
export function hammingDistance(a: string, b: string): number {
  check(a);
  check(b);
  let count = 0;
  for (let i = 0; i < a.length; i += 1) count += NIBBLE_BITS[parseInt(a[i]!, 16) ^ parseInt(b[i]!, 16)]!;
  return count;
}

/** How many edges the hash found. */
export function detailBits(hash: string): number {
  check(hash);
  let count = 0;
  for (let i = 0; i < hash.length; i += 1) count += NIBBLE_BITS[parseInt(hash[i]!, 16)]!;
  return count;
}

/**
 * The fewest edges a hash must hold to be worth comparing. A nearly flat picture (plain white, a soft gradient) sets almost no
 * bit, so every other flat picture is a perfect "match" to it. Those are never compared, in either direction.
 */
export const MIN_DETAIL_BITS = 12;

export const hasEnoughDetail = (hash: string): boolean => detailBits(hash) >= MIN_DETAIL_BITS;
