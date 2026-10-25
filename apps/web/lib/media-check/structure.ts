import type { Frame } from "./frame";
import { lumaOf } from "./frame";
import { boxBlur, gradientMagnitude, pearson } from "./planes";

/** Edge maps with fewer grey levels of spread than this have no seams or stripes to compare. */
export const MIN_EDGE_SPREAD = 4;
/** The edge map is softened once more so a seam that moved by a pixel or two still lines up. */
const EDGE_BLUR = 1;

/** The edge map of a frame: gradient size of its softened luma. */
export function edgeMap(frame: Frame): Float32Array {
  const blurred = boxBlur(lumaOf(frame), frame.width, frame.height, EDGE_BLUR);
  return gradientMagnitude(blurred, frame.width, frame.height);
}

/** Correlation of two edge maps over the pixels, or null when the reference has no edges there. */
export function edgeCorrelation(reference: Float32Array, generated: Float32Array, pixels: readonly number[]): number | null {
  const a = pixels.map((i) => reference[i] as number);
  const b = pixels.map((i) => generated[i] as number);
  const { r, spreadA } = pearson(a, b);
  return spreadA < MIN_EDGE_SPREAD ? null : r;
}
