import { z } from "zod";
import type { SettingDef } from "@/lib/settings/types";

/**
 * When a third-party inspection is offered (spec F-O3: "Third-party inspection can be booked for runs over
 * 300 pieces"; plan v5 O1, decision 0100).
 *
 * The 300 is the spec's own figure, seeded as a labelled default, and a setting rather than a literal so the
 * owner can change it without a deploy. Nothing here says what an inspection costs or how long it takes: no
 * inspection house has quoted either, so neither is shown.
 */

export const THIRD_PARTY_MIN_PIECES_KEY = "ops.third_party_inspection_over_pieces";

/** The spec's figure. A run of exactly this many pieces is not over it; 301 is. */
export const DEFAULT_THIRD_PARTY_OVER_PIECES = 300;

export const OPS_INSPECTION_SETTINGS: readonly SettingDef[] = [
  {
    key: THIRD_PARTY_MIN_PIECES_KEY,
    group: "factory",
    label: "Offer a third-party inspection above this many pieces",
    help: "A run larger than this may be inspected by a third party before it ships. 300 is the figure in the product spec (F-O3), not one an inspection house has agreed.",
    question: 25,
    input: "number",
    schema: z.number({ error: "Give a number." }).int("Whole numbers only.").min(1, "Use 1 or more.").max(1_000_000, "Use 1000000 or less."),
    fallback: DEFAULT_THIRD_PARTY_OVER_PIECES,
  },
];
