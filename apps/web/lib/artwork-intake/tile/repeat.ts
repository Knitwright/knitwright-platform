import sharp from "sharp";
import { luma, type Pixels } from "../raster/pixels";

/**
 * Finding a picture's repeat by autocorrelation: how far along each axis the picture must be shifted before
 * it looks like itself again. W7d uses it to find the tile in a picture of a pattern.
 */

export type Repeat = Readonly<{
  /** The repeat length in pixels of the picture given, or null when no repeat is found. */
  periodX: number | null;
  periodY: number | null;
  /** How alike the picture is to itself at that shift, 0 to 1. */
  confidenceX: number;
  confidenceY: number;
}>;

/** The working size: the picture is shrunk so its longest side is this many pixels, then the period is scaled back. */
const WORK_EDGE = 256;
/** Below this match, a shift is not called a repeat. */
const MIN_CONFIDENCE = 0.6;

const greyOf = (pixels: Pixels): { values: Float64Array; width: number; height: number } => {
  const values = new Float64Array(pixels.width * pixels.height);
  for (let i = 0; i < values.length; i += 1) values[i] = luma(pixels, i);
  const average = values.reduce((a, b) => a + b, 0) / values.length;
  return { values: values.map((value) => value - average), width: pixels.width, height: pixels.height };
};

const energy = (values: Float64Array): number => values.reduce((sum, value) => sum + value * value, 0);

/** Normalised correlation of the picture with itself shifted by `lag` along one axis. */
const correlation = (grey: ReturnType<typeof greyOf>, axis: "x" | "y", lag: number): number => {
  const { values, width, height } = grey;
  let sum = 0;
  let a = 0;
  let b = 0;
  const rows = axis === "x" ? height : height - lag;
  const columns = axis === "x" ? width - lag : width;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      const first = values[y * width + x];
      const second = axis === "x" ? values[y * width + x + lag] : values[(y + lag) * width + x];
      sum += first * second;
      a += first * first;
      b += second * second;
    }
  }
  return a === 0 || b === 0 ? 0 : sum / Math.sqrt(a * b);
};

const bestLag = (grey: ReturnType<typeof greyOf>, axis: "x" | "y"): { lag: number | null; confidence: number } => {
  const length = axis === "x" ? grey.width : grey.height;
  const maxLag = Math.floor(length * 0.75);
  const scores: number[] = [];
  for (let lag = 1; lag <= maxLag; lag += 1) scores.push(correlation(grey, axis, lag));
  // The first lag at which the score has fallen and then peaks high: the smallest repeat, not a multiple of it.
  let fallen = false;
  for (let i = 1; i < scores.length - 1; i += 1) {
    if (scores[i] < MIN_CONFIDENCE / 2) fallen = true;
    const isPeak = scores[i] >= scores[i - 1] && scores[i] > scores[i + 1];
    if (fallen && isPeak && scores[i] >= MIN_CONFIDENCE) return { lag: i + 1, confidence: Math.round(scores[i] * 1000) / 1000 };
  }
  return { lag: null, confidence: Math.round(Math.max(0, ...scores) * 1000) / 1000 };
};

/** Finds the repeat of a picture along both axes. Deterministic. */
export const findRepeat = async (pixels: Pixels): Promise<Repeat> => {
  const scale = Math.min(1, WORK_EDGE / Math.max(pixels.width, pixels.height));
  let work = pixels;
  if (scale < 1) {
    const { data, info } = await sharp(pixels.data, { raw: { width: pixels.width, height: pixels.height, channels: pixels.channels } })
      .resize(Math.max(2, Math.round(pixels.width * scale)), Math.max(2, Math.round(pixels.height * scale)), { kernel: "lanczos3" })
      .raw()
      .toBuffer({ resolveWithObject: true });
    work = { data: new Uint8Array(data), width: info.width, height: info.height, channels: info.channels === 4 ? 4 : 3 };
  }
  const grey = greyOf(work);
  if (energy(grey.values) === 0) return { periodX: null, periodY: null, confidenceX: 0, confidenceY: 0 };
  const x = bestLag(grey, "x");
  const y = bestLag(grey, "y");
  const back = (lag: number | null, workLength: number, fullLength: number) =>
    lag === null ? null : Math.max(1, Math.round((lag * fullLength) / workLength));
  return {
    periodX: back(x.lag, work.width, pixels.width),
    periodY: back(y.lag, work.height, pixels.height),
    confidenceX: x.confidence,
    confidenceY: y.confidence,
  };
};
