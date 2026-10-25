import { rgbToLab } from "@/lib/design-import/colours";
import { deltaE2000 } from "./ciede2000";
import type { Frame } from "./frame";
import { median } from "./planes";

const labAt = (frame: Frame, i: number) => rgbToLab([frame.r[i] as number, frame.g[i] as number, frame.b[i] as number]);

/** Median CIEDE2000 between the two pictures over the given pixel indices (same index, same place). NaN for none. */
export function medianDeltaE(reference: Frame, generated: Frame, pixels: readonly number[], offset = 0): number {
  const diffs = new Float32Array(pixels.length);
  for (let k = 0; k < pixels.length; k++) {
    const i = pixels[k] as number;
    diffs[k] = deltaE2000(labAt(reference, i), labAt(generated, i + offset));
  }
  return median(diffs);
}
