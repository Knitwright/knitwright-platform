import type { Pixels } from "../raster/pixels";

export type SeamlessMethod = "blend" | "mirror";

/** A weight that is 0 at both ends of a run of `length` pixels and 1 in the middle, smooth in between. */
const hat = (index: number, length: number): number => {
  const t = length <= 1 ? 1 : 1 - Math.abs((2 * index) / (length - 1) - 1);
  return t * t * (3 - 2 * t);
};

/**
 * Offset and blend. The picture is shifted by half its size in both directions, which puts its old seams in
 * the middle and makes the old middle meet at the edges, where it already fits. The result is the original in
 * the middle, fading into the shifted copy towards the edges. Deterministic. It softens detail near the edges,
 * so it suits textures better than photographs.
 */
const blendSeamless = (pixels: Pixels): Pixels => {
  const { width, height, channels } = pixels;
  const out = new Uint8Array(pixels.data.length);
  const halfX = Math.floor(width / 2);
  const halfY = Math.floor(height / 2);
  for (let y = 0; y < height; y += 1) {
    const wy = hat(y, height);
    const shiftedY = (y + halfY) % height;
    for (let x = 0; x < width; x += 1) {
      const weight = hat(x, width) * wy;
      const own = (y * width + x) * channels;
      const other = (shiftedY * width + ((x + halfX) % width)) * channels;
      for (let c = 0; c < channels; c += 1) {
        out[own + c] = Math.round(pixels.data[own + c] * weight + pixels.data[other + c] * (1 - weight));
      }
    }
  }
  return { data: out, width, height, channels };
};

/** 2 x 2 mirroring: the picture, its mirror to the right, below, and both. Always seamless, twice the size. */
const mirrorSeamless = (pixels: Pixels): Pixels => {
  const { width, height, channels } = pixels;
  const outWidth = width * 2;
  const out = new Uint8Array(outWidth * height * 2 * channels);
  for (let y = 0; y < height * 2; y += 1) {
    const sourceY = y < height ? y : 2 * height - 1 - y;
    for (let x = 0; x < outWidth; x += 1) {
      const sourceX = x < width ? x : 2 * width - 1 - x;
      const from = (sourceY * width + sourceX) * channels;
      out.set(pixels.data.subarray(from, from + channels), (y * outWidth + x) * channels);
    }
  }
  return { data: out, width: outWidth, height: height * 2, channels };
};

export const makeSeamless = (pixels: Pixels, method: SeamlessMethod): Pixels =>
  method === "mirror" ? mirrorSeamless(pixels) : blendSeamless(pixels);
