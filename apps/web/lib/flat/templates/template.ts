import type { Proportions } from "../dimensions";
import type { TopsOptions } from "./options";

/**
 * What a garment type adds to the shared drawing code for tops: its own default
 * proportions. A new tops type is a new file that exports one of these, an entry in
 * `templates/index.ts`, and registry data. The shapes themselves are shared.
 */
export interface TopsTemplate {
  readonly typeId: string;
  /** Every measurement as a ratio of the chest width. They are ratios, never lengths. */
  readonly proportions: (options: TopsOptions) => Proportions;
}

/**
 * Ratios of a regular top, all against the chest width. They set the SHAPE of a drawing
 * that has no measurements. They are the designer's starting point and not measurements
 * of any garment. A garment professional should look at them (see OWNER-QUESTIONS.md).
 */
export const BASE_RATIOS = {
  "chest-width": 1,
  "body-length": 1.35,
  "shoulder-width": 0.88,
  "sleeve-length": 0.42,
  armhole: 0.44,
  "upper-arm": 0.37,
  "sleeve-opening": 0.33,
  "hem-width": 1,
  "neck-width": 0.35,
  "front-neck-drop": 0.165,
  "back-neck-drop": 0.04,
  "collar-height": 0.11,
  "placket-length": 0.23,
  "placket-width": 0.06,
} as const satisfies Proportions;

/** Changes to the base ratios that follow from the options, the same for every tops type. */
export function tuneForOptions(base: Proportions, options: TopsOptions): Proportions {
  const long = options.longSleeve;
  const at = (id: string): number => base[id] ?? 0;
  const sleeve: Proportions = options.raglan
    ? { "sleeve-length": long ? 1.28 : 0.55, armhole: 0.62, "upper-arm": long ? 0.24 : 0.32 }
    : { "sleeve-length": long ? 1.15 : at("sleeve-length"), "upper-arm": long ? 0.27 : at("upper-arm") };
  return {
    ...base,
    ...sleeve,
    "sleeve-opening": long ? 0.19 : at("sleeve-opening"),
    "front-neck-drop": options.neck === "v" ? 0.3 : at("front-neck-drop"),
  };
}
