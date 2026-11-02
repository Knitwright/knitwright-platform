import { CROPS, type Crop } from "./types";

/**
 * The crops of `07` ("crop presets (1:1, 4:5, 9:16, 16:9)"), and the one number that turns a crop
 * into a canvas: the longest side in pixels.
 *
 * The ratio itself is arithmetic, not a policy: 4:5 is four over five wherever it is written down.
 * The **size** a mockup is rendered at is a setting, so `MOCKUP_EDGE` is a labelled default this
 * workstream seeds and a caller may override, exactly as `REFERENCE_EDGE` is for the reference
 * picture. Nothing here is reviewed by anyone.
 */

/** Why this number and not another: it is the reference render's own edge, so nothing is upscaled. */
export const MOCKUP_EDGE_NOTE = "The longest side of a mockup, matched to the reference render so nothing is enlarged. Not reviewed by anyone.";

/** The longest side of a rendered mockup, in pixels. A labelled default (see the note above). */
export const MOCKUP_EDGE = 1024;

/** The smallest and largest longest side the renderer will work at. A size outside is refused. */
export const EDGE_BOUNDS = { min: 64, max: 4096 } as const;

export const CROP_LABELS: Readonly<Record<Crop, string>> = {
  "1:1": "Square 1:1",
  "4:5": "Portrait 4:5",
  "9:16": "Story 9:16",
  "16:9": "Wide 16:9",
};

const RATIOS: Readonly<Record<Crop, readonly [number, number]>> = {
  "1:1": [1, 1],
  "4:5": [4, 5],
  "9:16": [9, 16],
  "16:9": [16, 9],
};

export interface CanvasSize {
  readonly width: number;
  readonly height: number;
}

export const isCrop = (value: string): value is Crop => (CROPS as readonly string[]).includes(value);

/** The ratio of a crop as width over height. */
export const ratioOf = (crop: Crop): number => RATIOS[crop][0] / RATIOS[crop][1];

/**
 * The canvas a crop asks for at this longest side, in whole pixels. The longer side is `edge`
 * exactly, so two crops of one scene are never the same picture at two sizes by accident.
 */
export function canvasFor(crop: Crop, edge: number = MOCKUP_EDGE): CanvasSize {
  const size = Math.round(edge);
  if (size < EDGE_BOUNDS.min || size > EDGE_BOUNDS.max) {
    throw new RangeError(`A mockup's longest side is between ${EDGE_BOUNDS.min} px and ${EDGE_BOUNDS.max} px; ${size} px was asked for.`);
  }
  const ratio = ratioOf(crop);
  return ratio >= 1 ? { width: size, height: Math.max(1, Math.round(size / ratio)) } : { width: Math.max(1, Math.round(size * ratio)), height: size };
}

/** The crop a canvas is closest to, for a picture that came from somewhere else. */
export function nearestCrop(size: CanvasSize): Crop {
  const wanted = size.width / size.height;
  return [...CROPS].sort((a, b) => Math.abs(ratioOf(a) - wanted) - Math.abs(ratioOf(b) - wanted))[0]!;
}
