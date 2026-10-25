import type { Frame } from "./frame";
import { lumaOf } from "./frame";
import { pearson } from "./planes";
import type { Rect } from "./types";

/** A mark with less spread than this (grey levels) is a flat patch: nothing to correlate. */
export const MIN_MARK_SPREAD = 3;
/** The generated crop may sit this many pixels off (analysis pixels) and still count as the same mark. */
export const SEARCH_RADIUS = 2;

export interface MarkMatch {
  /** Best normalised cross-correlation over the small search. Null when the reference mark is flat. */
  readonly correlation: number | null;
  /** The offset, in pixels of the whole frame, at which the best match was found. */
  readonly offset: number;
  /** True when the generated crop has no detail at all where the reference has some. */
  readonly blank: boolean;
}

const crop = (luma: Float32Array, width: number, rect: Rect, dx: number, dy: number): number[] => {
  const out: number[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) for (let x = rect.x; x < rect.x + rect.width; x++) out.push(luma[(y + dy) * width + x + dx] as number);
  return out;
};

const fits = (rect: Rect, frame: Frame, dx: number, dy: number): boolean =>
  rect.x + dx >= 0 && rect.y + dy >= 0 && rect.x + rect.width + dx <= frame.width && rect.y + rect.height + dy <= frame.height;

/** Compares the reference crop of a mark with the generated picture at the same place and a few pixels around it. */
export function matchMark(reference: Frame, generated: Frame, rect: Rect): MarkMatch {
  const [refLuma, genLuma] = [lumaOf(reference), lumaOf(generated)];
  const want = crop(refLuma, reference.width, rect, 0, 0);
  if (pearson(want, want).spreadA < MIN_MARK_SPREAD) return { correlation: null, offset: 0, blank: false };
  let best = { correlation: -2, spreadB: 0, offset: 0 };
  for (let dy = -SEARCH_RADIUS; dy <= SEARCH_RADIUS; dy++) {
    for (let dx = -SEARCH_RADIUS; dx <= SEARCH_RADIUS; dx++) {
      if (!fits(rect, generated, dx, dy)) continue;
      const { r, spreadB } = pearson(want, crop(genLuma, generated.width, rect, dx, dy));
      if (r > best.correlation) best = { correlation: r, spreadB, offset: dy * generated.width + dx };
    }
  }
  return { correlation: best.correlation, offset: best.offset, blank: best.spreadB < MIN_MARK_SPREAD };
}
