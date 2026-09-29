import type { Proportions } from "../../dimensions";
import { BASE_RATIOS, tuneForOptions } from "../../templates/template";
import { asTopsOptions, type CloseFitOptions } from "./options";

/**
 * Ratios of close-fitting garments, all against the chest width. They set the SHAPE of a
 * drawing that has no measurements, and are not measurements of any garment (see
 * OWNER-QUESTIONS.md). A compression top starts from the ratios of a tee, made closer.
 */
const COMPRESSION = {
  "body-length": 1.32,
  "hem-width": 0.9,
  "shoulder-width": 0.86,
  "neck-width": 0.34,
  "front-neck-drop": 0.14,
} as const satisfies Proportions;

const SLEEVELESS: Readonly<Record<"singlet" | "vest" | "sports-bra", Proportions>> = {
  singlet: {
    "chest-width": 1,
    "body-length": 1.38,
    "hem-width": 0.98,
    "neck-width": 0.38,
    "front-neck-drop": 0.3,
    "back-neck-drop": 0.12,
    "armhole-depth": 0.52,
    "strap-width": 0.1,
    "back-width-narrowest": 0.72,
  },
  vest: {
    "chest-width": 1,
    "body-length": 1.36,
    "hem-width": 0.98,
    "neck-width": 0.36,
    "front-neck-drop": 0.25,
    "back-neck-drop": 0.08,
    "armhole-depth": 0.46,
    "strap-width": 0.16,
    "back-width-narrowest": 0.76,
  },
  "sports-bra": {
    "chest-width": 1,
    "body-length": 0.62,
    underbust: 0.86,
    "neck-width": 0.36,
    "front-neck-drop": 0.26,
    "back-neck-drop": 0.18,
    "armhole-depth": 0.34,
    "strap-width": 0.12,
    "back-width-narrowest": 0.72,
  },
};

/** A racerback narrows the back to a strap between the shoulder blades. */
const RACERBACK: Proportions = { "back-width-narrowest": 0.2, "back-neck-drop": 0.1 };

/** The ratios for a design, from its options. */
export function closeFitProportions(options: CloseFitOptions): Proportions {
  if (options.kind === "compression-top") {
    const tops = asTopsOptions(options);
    const long = tops.longSleeve;
    return { ...tuneForOptions({ ...BASE_RATIOS, ...COMPRESSION }, tops), "upper-arm": long ? 0.26 : 0.32, "sleeve-opening": long ? 0.17 : 0.3 };
  }
  return { ...SLEEVELESS[options.kind], ...(options.racerback ? RACERBACK : {}) };
}
