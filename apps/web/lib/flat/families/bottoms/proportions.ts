import type { Proportions } from "../../dimensions";
import type { BottomsOptions } from "./options";

/**
 * Ratios of a pair of bottoms, all against the hip width. They set the SHAPE of a drawing
 * that has no measurements. They are a designer's starting point and not measurements of
 * any garment. A garment professional should look at them (see OWNER-QUESTIONS.md).
 */
const FULL_LENGTH = {
  "waist-relaxed": 0.74,
  "waist-stretched": 1.06,
  "waistband-height": 0.075,
  hip: 1,
  "front-rise": 0.56,
  "back-rise": 0.7,
  thigh: 0.55,
  knee: 0.4,
  "leg-opening": 0.3,
  inseam: 1.5,
  outseam: 2.02,
} as const satisfies Proportions;

const LEG_LENGTH: Readonly<Record<BottomsOptions["legLength"], Proportions>> = {
  short: { inseam: 0.3, outseam: 0.82, "leg-opening": 0.5, thigh: 0.58 },
  cropped: { inseam: 1.12, outseam: 1.64 },
  full: {},
};

const LEGGINGS: Proportions = { "front-rise": 0.5, "back-rise": 0.64, thigh: 0.5, knee: 0.33, "leg-opening": 0.2, outseam: 1.96 };

/** The ratios for a design, from its options. */
export function bottomsProportions(options: BottomsOptions): Proportions {
  const base: Record<string, number> = { ...FULL_LENGTH, ...(options.leggings ? LEGGINGS : {}), ...LEG_LENGTH[options.legLength] };
  if (options.leggings && options.legLength === "cropped") {
    base["leg-opening"] = 0.24;
    base.outseam = 1.58;
  }
  if (options.legFinish === "rib-cuff") base["leg-opening"] = 0.24;
  if (options.waistband === "wide-band") {
    base["waistband-height"] = 0.15;
    base["waist-relaxed"] = 0.7;
  }
  return base;
}
