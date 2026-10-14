import type { RgbaImage } from "../white-box";

/** The distance, in pixels, after which a picture repeats itself along each axis. */
export type RepeatFound = Readonly<{ periodX: number | null; periodY: number | null; confidence: number }>;

const MIN_LAG = 4;
const MIN_CORRELATION = 0.5;
const MAX_SAMPLE_LINES = 16;

const luminance = (image: RgbaImage): Float32Array => {
  const out = new Float32Array(image.width * image.height);
  for (let i = 0; i < out.length; i += 1) {
    const at = i * 4;
    out[i] = (0.2126 * image.data[at] + 0.7152 * image.data[at + 1] + 0.0722 * image.data[at + 2]) * (image.data[at + 3] / 255);
  }
  return out;
};

/** Normalised autocorrelation of one line at every lag from MIN_LAG up to half its length. */
function correlations(line: Float32Array): Float32Array {
  const n = line.length;
  const mean = line.reduce((sum, value) => sum + value, 0) / n;
  const centred = line.map((value) => value - mean);
  const energy = centred.reduce((sum, value) => sum + value * value, 0);
  const out = new Float32Array(Math.floor(n / 2) + 1);
  if (energy === 0) return out;
  for (let lag = MIN_LAG; lag < out.length; lag += 1) {
    let sum = 0;
    for (let i = 0; i + lag < n; i += 1) sum += centred[i] * centred[i + lag];
    out[lag] = sum / energy;
  }
  return out;
}

const sampleLines = (grey: Float32Array, width: number, height: number, axis: "x" | "y"): Float32Array[] => {
  const count = axis === "x" ? height : width;
  const length = axis === "x" ? width : height;
  const picks = Math.min(MAX_SAMPLE_LINES, count);
  return Array.from({ length: picks }, (_, k) => {
    const line = Math.floor(((k + 0.5) * count) / picks);
    return Float32Array.from({ length }, (_, i) => (axis === "x" ? grey[line * width + i] : grey[i * width + line]));
  });
};

/** The first lag whose correlation is close to the best one, so a repeat of 20 is not reported as 40. */
function bestLag(averaged: Float32Array): { lag: number | null; value: number } {
  let best = 0;
  for (let lag = MIN_LAG; lag < averaged.length; lag += 1) best = Math.max(best, averaged[lag]);
  if (best < MIN_CORRELATION) return { lag: null, value: Math.max(0, best) };
  for (let lag = MIN_LAG + 1; lag < averaged.length - 1; lag += 1) {
    const peak = averaged[lag] >= averaged[lag - 1] && averaged[lag] >= averaged[lag + 1];
    if (peak && averaged[lag] >= best * 0.9) return { lag, value: averaged[lag] };
  }
  return { lag: null, value: best };
}

function axisPeriod(grey: Float32Array, width: number, height: number, axis: "x" | "y") {
  const lines = sampleLines(grey, width, height, axis).map(correlations);
  const length = lines[0]?.length ?? 0;
  const averaged = new Float32Array(length);
  for (const line of lines) for (let i = 0; i < length; i += 1) averaged[i] += line[i] / lines.length;
  return bestLag(averaged);
}

/**
 * Finds the repeat of an all-over picture by autocorrelation along rows and columns. Give it a picture
 * of a few hundred pixels across; larger ones are slow and gain nothing.
 */
export function findRepeat(image: RgbaImage): RepeatFound {
  const grey = luminance(image);
  const x = axisPeriod(grey, image.width, image.height, "x");
  const y = axisPeriod(grey, image.width, image.height, "y");
  const found = [x, y].filter((axis) => axis.lag !== null).map((axis) => axis.value);
  const confidence = found.length === 0 ? 0 : Math.min(...found);
  return { periodX: x.lag, periodY: y.lag, confidence: Math.round(confidence * 100) / 100 };
}
