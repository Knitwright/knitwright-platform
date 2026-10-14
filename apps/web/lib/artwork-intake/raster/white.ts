/**
 * Finding and removing the white box some logos are saved on. Sublimation prints no white ink, so white in
 * the art is the fabric's own colour; a logo on a white box would print as a patch of that colour.
 */

import type { Pixels } from "./pixels";

/** A pixel counts as white at or above this value on every channel. */
const WHITE_FLOOR = 250;
/** The share of the border that must be white for the picture to count as being on a white box. */
const BORDER_SHARE = 0.98;
/** At least this share of the picture must be something other than white, so a blank page is not a logo. */
const CONTENT_SHARE = 0.005;

const isWhite = (pixels: Pixels, index: number, floor: number): boolean => {
  const at = index * pixels.channels;
  const opaque = pixels.channels === 3 || pixels.data[at + 3] >= 250;
  return opaque && pixels.data[at] >= floor && pixels.data[at + 1] >= floor && pixels.data[at + 2] >= floor;
};

/** Whether the picture's whole edge is opaque white and something else sits inside. */
export const hasWhiteBackground = (pixels: Pixels): boolean => {
  const { width, height } = pixels;
  if (width < 3 || height < 3) return false;
  let border = 0;
  let white = 0;
  const check = (x: number, y: number) => {
    border += 1;
    if (isWhite(pixels, y * width + x, WHITE_FLOOR)) white += 1;
  };
  for (let x = 0; x < width; x += 1) {
    check(x, 0);
    check(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    check(0, y);
    check(width - 1, y);
  }
  if (white / border < BORDER_SHARE) return false;
  let content = 0;
  for (let i = 0; i < width * height; i += 1) if (!isWhite(pixels, i, WHITE_FLOOR)) content += 1;
  return content / (width * height) >= CONTENT_SHARE;
};

/**
 * Makes the white that touches the picture's edge see-through. A white that is enclosed by the art (the
 * white of an eye, a letter's counter) is kept. Returns new pixels with an alpha channel; the input is not changed.
 */
export const removeWhiteBackground = (pixels: Pixels, tolerance = 12): { pixels: Pixels; removed: number } => {
  const { width, height } = pixels;
  const floor = 255 - tolerance;
  const out = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const from = i * pixels.channels;
    out.set(pixels.data.subarray(from, from + 3), i * 4);
    out[i * 4 + 3] = pixels.channels === 4 ? pixels.data[from + 3] : 255;
  }
  const seen = new Uint8Array(width * height);
  const stack: number[] = [];
  let removed = 0;
  const push = (x: number, y: number) => {
    const index = y * width + x;
    if (x < 0 || y < 0 || x >= width || y >= height || seen[index] === 1) return;
    seen[index] = 1;
    if (isWhite(pixels, index, floor)) stack.push(index);
  };
  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y);
    push(width - 1, y);
  }
  while (stack.length > 0) {
    const index = stack.pop() as number;
    out[index * 4 + 3] = 0;
    removed += 1;
    const x = index % width;
    const y = (index - x) / width;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  return { pixels: { data: out, width, height, channels: 4 }, removed };
};
