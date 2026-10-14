/** Pixels as 8-bit RGBA, row by row. */
export type RgbaImage = Readonly<{ data: Uint8Array; width: number; height: number }>;

/** How far from pure white a pixel may be and still count as the white of a box. */
const WHITE_TOLERANCE = 12;
const MIN_EDGE_SHARE = 0.98;

const isWhite = (data: Uint8Array, at: number): boolean =>
  data[at + 3] >= 250 &&
  data[at] >= 255 - WHITE_TOLERANCE &&
  data[at + 1] >= 255 - WHITE_TOLERANCE &&
  data[at + 2] >= 255 - WHITE_TOLERANCE;

/** The pixel offsets of the outermost ring of the picture. */
function* ring(width: number, height: number): Generator<number> {
  for (let x = 0; x < width; x += 1) {
    yield x * 4;
    yield ((height - 1) * width + x) * 4;
  }
  for (let y = 1; y < height - 1; y += 1) {
    yield y * width * 4;
    yield (y * width + width - 1) * 4;
  }
}

/**
 * A logo on an opaque white box: the whole outer ring is white and there is something that is not white inside.
 * Sublimation prints no white ink, so the white box would show as the fabric's own colour, not as a box.
 */
export function hasWhiteBox(image: RgbaImage): boolean {
  const { data, width, height } = image;
  if (width < 3 || height < 3) return false;
  let ringPixels = 0;
  let whitePixels = 0;
  for (const at of ring(width, height)) {
    ringPixels += 1;
    if (isWhite(data, at)) whitePixels += 1;
  }
  if (whitePixels / ringPixels < MIN_EDGE_SHARE) return false;
  for (let at = 0; at < data.length; at += 4) if (!isWhite(data, at)) return true;
  return false;
}

/**
 * Makes the white that touches the border see-through, and nothing else: white inside the artwork (the
 * eye of a badge) stays. Returns new pixels. The edge of the artwork is left as it is.
 */
export function removeWhiteBox(image: RgbaImage): RgbaImage {
  const { width, height } = image;
  const data = new Uint8Array(image.data);
  const seen = new Uint8Array(width * height);
  const stack: number[] = [];
  const push = (pixel: number): void => {
    if (seen[pixel] === 0 && isWhite(data, pixel * 4)) {
      seen[pixel] = 1;
      stack.push(pixel);
    }
  };
  for (const at of ring(width, height)) push(at / 4);
  while (stack.length > 0) {
    const pixel = stack.pop() as number;
    data[pixel * 4 + 3] = 0;
    const x = pixel % width;
    if (x > 0) push(pixel - 1);
    if (x < width - 1) push(pixel + 1);
    if (pixel >= width) push(pixel - width);
    if (pixel < width * (height - 1)) push(pixel + width);
  }
  return { data, width, height };
}
