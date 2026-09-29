import type { Proportions } from "../../dimensions";
import { BAND_WIDTH } from "../../templates/basis";
import { BASE_RATIOS, tuneForOptions } from "../../templates/template";
import { asTopsOptions, type OuterwearOptions } from "./options";

/**
 * Ratios of a hoodie or track jacket, all against the chest width. The body, sleeves and neck
 * start from the ratios of a top with long sleeves. They set the SHAPE of a drawing that has
 * no measurements. They are not measurements of any garment (see OWNER-QUESTIONS.md).
 */
const OUTERWEAR_RATIOS = {
  "body-length": 1.2,
  "shoulder-width": 0.9,
  "neck-width": 0.36,
  "front-neck-drop": 0.15,
  "hood-height": 0.62,
  "hood-width": 0.46,
  "pocket-opening": 0.3,
  "pocket-width": 0.62,
  "pocket-height": 0.36,
  "cuff-height": 0.12,
  "hem-band-height": 0.12,
  "collar-height": 0.13,
} as const satisfies Proportions;

/** The ratios for a design, from its options. */
export function outerwearProportions(options: OuterwearOptions): Proportions {
  const body = { ...tuneForOptions({ ...BASE_RATIOS, ...OUTERWEAR_RATIOS }, asTopsOptions(options)) };
  const bodyLength = body["body-length"] ?? 0;
  const drop = body["front-neck-drop"] ?? 0;
  const top = options.collar === "stand" ? drop - (body["collar-height"] ?? 0) : drop + BAND_WIDTH;
  // The zip runs from the hem up to the neck seam, or into a stand collar to its top edge.
  return { ...body, "zip-length": Math.round((bodyLength - top) * 1000) / 1000 };
}
