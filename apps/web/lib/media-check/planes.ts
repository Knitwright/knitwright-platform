/** Small pixel-plane tools for the checks. All of them return new arrays and leave their input alone. */

/** One running-sum pass along rows (or columns) with clamped edges. */
function blurPass(src: Float32Array, width: number, height: number, radius: number, rows: boolean): Float32Array {
  const out = new Float32Array(src.length);
  const [lines, length, stride, step] = rows ? [height, width, width, 1] : [width, height, 1, width];
  const span = 2 * radius + 1;
  for (let line = 0; line < lines; line++) {
    const base = line * stride;
    const at = (k: number): number => src[base + Math.min(length - 1, Math.max(0, k)) * step] as number;
    let sum = 0;
    for (let k = -radius; k <= radius; k++) sum += at(k);
    for (let k = 0; k < length; k++) {
      out[base + k * step] = sum / span;
      sum += at(k + radius + 1) - at(k - radius);
    }
  }
  return out;
}

/** A box blur with the given radius (a square of side 2r+1), edges clamped. */
export function boxBlur(src: Float32Array, width: number, height: number, radius: number): Float32Array {
  if (radius <= 0) return Float32Array.from(src);
  return blurPass(blurPass(src, width, height, radius, true), width, height, radius, false);
}

/** Shrinks a 0/1 mask by `radius` pixels (a pixel stays only if its whole square is set). Outside the picture counts as unset. */
export function erode(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  const window = (2 * radius + 1) ** 2;
  return squareCount(mask, width, height, radius, (count) => (count === window ? 1 : 0));
}

/** Grows a 0/1 mask by `radius` pixels. */
export function dilate(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  return squareCount(mask, width, height, radius, (count) => (count > 0 ? 1 : 0));
}

/** For each pixel, the number of set pixels in the square around it (outside the picture is unset), turned into 0/1 by `decide`. */
function squareCount(mask: Uint8Array, width: number, height: number, radius: number, decide: (count: number) => number): Uint8Array {
  const pad = (v: number, limit: number): boolean => v >= 0 && v < limit;
  const rowSums = new Int32Array(mask.length);
  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let k = -radius; k <= radius; k++) if (pad(k, width)) sum += mask[y * width + k] as number;
    for (let x = 0; x < width; x++) {
      rowSums[y * width + x] = sum;
      if (pad(x + radius + 1, width)) sum += mask[y * width + x + radius + 1] as number;
      if (pad(x - radius, width)) sum -= mask[y * width + x - radius] as number;
    }
  }
  const out = new Uint8Array(mask.length);
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let k = -radius; k <= radius; k++) if (pad(k, height)) sum += rowSums[k * width + x] as number;
    for (let y = 0; y < height; y++) {
      out[y * width + x] = decide(sum);
      if (pad(y + radius + 1, height)) sum += rowSums[(y + radius + 1) * width + x] as number;
      if (pad(y - radius, height)) sum -= rowSums[(y - radius) * width + x] as number;
    }
  }
  return out;
}

/** Gradient magnitude (Sobel) of a plane. The one-pixel border is zero. */
export function gradientMagnitude(src: Float32Array, width: number, height: number): Float32Array {
  const out = new Float32Array(src.length);
  const at = (x: number, y: number): number => src[y * width + x] as number;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const gx = at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
      const gy = at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1);
      out[y * width + x] = Math.hypot(gx, gy);
    }
  }
  return out;
}

/** The middle value of the list (the mean of the two middle values for an even count). NaN for an empty list. */
export function median(values: Float32Array | number[]): number {
  if (values.length === 0) return Number.NaN;
  const sorted = Float32Array.from(values).sort();
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/**
 * Pearson correlation of two equal-length lists, and the spread of the first. A list with no spread
 * has no correlation: the answer is 0 and `spreadA` shows why.
 */
export function pearson(a: ArrayLike<number>, b: ArrayLike<number>): { r: number; spreadA: number; spreadB: number } {
  const n = a.length;
  if (n === 0) return { r: 0, spreadA: 0, spreadB: 0 };
  let [sa, sb] = [0, 0];
  for (let i = 0; i < n; i++) {
    sa += a[i] as number;
    sb += b[i] as number;
  }
  const [ma, mb] = [sa / n, sb / n];
  let [saa, sbb, sab] = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    const [da, db] = [(a[i] as number) - ma, (b[i] as number) - mb];
    saa += da * da;
    sbb += db * db;
    sab += da * db;
  }
  const [spreadA, spreadB] = [Math.sqrt(saa / n), Math.sqrt(sbb / n)];
  return { r: saa === 0 || sbb === 0 ? 0 : sab / Math.sqrt(saa * sbb), spreadA, spreadB };
}
