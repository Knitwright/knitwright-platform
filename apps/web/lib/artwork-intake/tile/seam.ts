import type { RgbaImage } from "../white-box";

/**
 * Whether a picture repeats cleanly when laid side by side. The step from the last column to the first
 * (and the last row to the first) is compared with the steps the picture takes anywhere else. A step as
 * big as the picture's own biggest steps is part of the picture (a stripe edge); a bigger one is a seam.
 */

export type SeamReport = Readonly<{
  /** How much bigger the step across the repeat is than the picture's own biggest steps, 0 to 100. Lower is better. */
  mismatch: number;
  horizontal: number;
  vertical: number;
  showsSeam: boolean;
  verdict: string;
}>;

export const SEAM_THRESHOLD = 3;
export const SEAMLESS_VERDICT = "The repeat looks seamless.";
export const SEAM_VERDICT = "The repeat shows a seam.";

const CHANNELS = 4;

/** Mean absolute difference between two pixel lines, as a share of full scale. */
const lineGap = (data: Uint8Array, from: number, to: number, count: number, stride: number): number => {
  let total = 0;
  for (let i = 0; i < count; i += 1) {
    const a = from + i * stride;
    const b = to + i * stride;
    for (let c = 0; c < CHANNELS; c += 1) total += Math.abs(data[a + c] - data[b + c]);
  }
  return total / (count * CHANNELS * 255);
};

const percentile = (values: readonly number[], share: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))];
};

/** Excess of the wrap-around step over the picture's own big steps, along one axis, as a share of full scale. */
function axisExcess(image: RgbaImage, axis: "x" | "y"): number {
  const { data, width, height } = image;
  const lines = axis === "x" ? width : height;
  if (lines < 3) return 0;
  const across = axis === "x" ? height : width;
  const step = axis === "x" ? CHANNELS : width * CHANNELS;
  const cross = axis === "x" ? width * CHANNELS : CHANNELS;
  const inner: number[] = [];
  for (let line = 0; line < lines - 1; line += 1) inner.push(lineGap(data, line * step, (line + 1) * step, across, cross));
  const wrap = lineGap(data, (lines - 1) * step, 0, across, cross);
  return Math.max(0, wrap - percentile(inner, 0.98));
}

export function measureSeam(image: RgbaImage): SeamReport {
  const horizontal = axisExcess(image, "x") * 100;
  const vertical = axisExcess(image, "y") * 100;
  const mismatch = Math.round(Math.max(horizontal, vertical) * 10) / 10;
  const showsSeam = mismatch >= SEAM_THRESHOLD;
  return {
    mismatch,
    horizontal: Math.round(horizontal * 10) / 10,
    vertical: Math.round(vertical * 10) / 10,
    showsSeam,
    verdict: showsSeam ? SEAM_VERDICT : SEAMLESS_VERDICT,
  };
}
