import type { RgbaImage } from "../white-box";

export const SEAMLESS_METHODS = ["blend", "mirror"] as const;
export type SeamlessMethod = (typeof SEAMLESS_METHODS)[number];

/** The limits of both methods, said plainly wherever they are offered. */
export const SEAMLESS_LIMIT =
  "Photographs and drawings with large detail cannot be fixed convincingly. Check the 3 x 3 preview before you accept.";

const CHANNELS = 4;
const MIN_BLEND_EDGE = 8;
const BLEND_SHARE = 0.15;

const pixel = (image: RgbaImage, x: number, y: number): number => (y * image.width + x) * CHANNELS;

/** Blends the first `band` columns with the columns that continue the last ones, then drops those columns. */
function blendColumns(image: RgbaImage, band: number): RgbaImage {
  const width = image.width - band;
  const data = new Uint8Array(width * image.height * CHANNELS);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const target = (y * width + x) * CHANNELS;
      const own = pixel(image, x, y);
      if (x >= band) {
        data.set(image.data.subarray(own, own + CHANNELS), target);
        continue;
      }
      const other = pixel(image, width + x, y);
      const weight = x / band;
      for (let c = 0; c < CHANNELS; c += 1) {
        data[target + c] = Math.round(image.data[other + c] * (1 - weight) + image.data[own + c] * weight);
      }
    }
  }
  return { data, width, height: image.height };
}

const transpose = (image: RgbaImage): RgbaImage => {
  const data = new Uint8Array(image.data.length);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const from = pixel(image, x, y);
      data.set(image.data.subarray(from, from + CHANNELS), (x * image.height + y) * CHANNELS);
    }
  }
  return { data, width: image.height, height: image.width };
};

/** Offset and blend: the first band of each axis is crossfaded with the picture's own continuation, so the last pixel is followed by the one that would have come next. The picture gets smaller by the band. */
function blend(image: RgbaImage): RgbaImage {
  const band = Math.floor(Math.min(image.width, image.height) * BLEND_SHARE);
  return transpose(blendColumns(transpose(blendColumns(image, band)), band));
}

/** The picture and its mirror images in a 2 x 2 block. Opposite edges are the same line, so it cannot show a seam; a mirrored look is its price. */
function mirror(image: RgbaImage): RgbaImage {
  const width = image.width * 2;
  const height = image.height * 2;
  const data = new Uint8Array(width * height * CHANNELS);
  for (let y = 0; y < height; y += 1) {
    const sourceY = y < image.height ? y : height - 1 - y;
    for (let x = 0; x < width; x += 1) {
      const sourceX = x < image.width ? x : width - 1 - x;
      const from = pixel(image, sourceX, sourceY);
      data.set(image.data.subarray(from, from + CHANNELS), (y * width + x) * CHANNELS);
    }
  }
  return { data, width, height };
}

/** A new picture that repeats more cleanly. A picture too small to blend is mirrored instead. */
export function makeSeamless(image: RgbaImage, method: SeamlessMethod): RgbaImage {
  if (method === "mirror" || Math.min(image.width, image.height) < MIN_BLEND_EDGE) return mirror(image);
  return blend(image);
}

/** The picture laid out `times` x `times`, to look at the repeat. */
export function repeatImage(image: RgbaImage, times: number): RgbaImage {
  const width = image.width * times;
  const height = image.height * times;
  const data = new Uint8Array(width * height * CHANNELS);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const from = pixel(image, x % image.width, y % image.height);
      data.set(image.data.subarray(from, from + CHANNELS), (y * width + x) * CHANNELS);
    }
  }
  return { data, width, height };
}
