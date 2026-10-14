import { luma, type Pixels } from "../raster/pixels";

/**
 * How well a picture repeats. When a tile is laid side by side, its right edge meets its own left edge, and
 * its bottom edge meets its top edge. The seam is how different those meeting pixels are, set against how
 * different neighbouring pixels are inside the picture itself.
 */

export type SeamReport = Readonly<{
  /** How far apart the meeting edges are on the worse axis, 0 to 100 (100 is black against white). Lower is better. */
  mismatch: number;
  horizontal: number;
  vertical: number;
  /** Plain words: "The repeat looks seamless" or "The repeat shows a seam". */
  verdict: string;
  seamless: boolean;
}>;

/** A seam under this many grey levels (of 255) is not visible, however still the picture is. */
const VISIBLE_LEVELS = 6;
/** A seam must be this many times the picture's own neighbour-to-neighbour change to count as one. */
const TIMES_NATURAL = 2.5;

type Edge = Readonly<{ seam: number; natural: number }>;

const mean = (values: readonly number[]): number => (values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length);

/** The mean change across the wrap, and the mean change between neighbours, along one axis. */
const edge = (pixels: Pixels, along: "x" | "y"): Edge => {
  const { width, height } = pixels;
  const lines = along === "x" ? height : width;
  const length = along === "x" ? width : height;
  const at = (line: number, step: number) => luma(pixels, along === "x" ? line * width + step : step * width + line);
  const seam: number[] = [];
  const natural: number[] = [];
  for (let line = 0; line < lines; line += 1) {
    seam.push(Math.abs(at(line, length - 1) - at(line, 0)));
    for (let step = 0; step + 1 < length; step += 1) natural.push(Math.abs(at(line, step) - at(line, step + 1)));
  }
  return { seam: mean(seam), natural: mean(natural) };
};

const round1 = (value: number): number => Math.round(value * 10) / 10;

export const seamReport = (pixels: Pixels): SeamReport => {
  const x = edge(pixels, "x");
  const y = edge(pixels, "y");
  const horizontal = round1((x.seam / 255) * 100);
  const vertical = round1((y.seam / 255) * 100);
  const visible = (e: Edge) => e.seam > VISIBLE_LEVELS && e.seam > TIMES_NATURAL * e.natural;
  const seamless = !visible(x) && !visible(y);
  return {
    mismatch: Math.max(horizontal, vertical),
    horizontal,
    vertical,
    seamless,
    verdict: seamless ? "The repeat looks seamless." : "The repeat shows a seam.",
  };
};
