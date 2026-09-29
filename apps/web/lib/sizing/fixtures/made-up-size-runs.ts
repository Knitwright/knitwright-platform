/**
 * MADE-UP NUMBERS FOR TESTS ONLY.
 *
 * These size labels and every number in the made-up fixture files are invented so the
 * tests have something to work with. They are not garment measurements. Nobody should
 * use them for a real garment. They must never be loaded as the default charts, and
 * nothing under `lib/sizing/charts/` may import from this folder. A test checks that.
 * The real size runs and charts arrive with owner action A5.
 */
import type { SizeRun } from "../schemas";

export const MADE_UP_MEN_RUN: SizeRun = {
  id: "made-up-men",
  wearer: "men",
  sizes: ["T1", "T2", "T3", "T4", "T5"],
};

export const MADE_UP_WOMEN_RUN: SizeRun = {
  id: "made-up-women",
  wearer: "women",
  sizes: ["U1", "U2", "U3", "U4"],
};

export const MADE_UP_YOUTH_RUN: SizeRun = {
  id: "made-up-youth",
  wearer: "youth",
  sizes: ["V1", "V2", "V3"],
};

/** Sports bras use their own size system, declared in the garment registry. */
export const MADE_UP_WOMEN_BRA_RUN: SizeRun = {
  id: "made-up-women-bra",
  wearer: "women",
  system: "sports-bra",
  sizes: ["W1", "W2", "W3", "W4"],
};

export const MADE_UP_YOUTH_BRA_RUN: SizeRun = {
  id: "made-up-youth-bra",
  wearer: "youth",
  system: "sports-bra",
  sizes: ["X1", "X2", "X3"],
};

export const MADE_UP_RUNS: readonly SizeRun[] = [
  MADE_UP_MEN_RUN,
  MADE_UP_WOMEN_RUN,
  MADE_UP_YOUTH_RUN,
  MADE_UP_WOMEN_BRA_RUN,
  MADE_UP_YOUTH_BRA_RUN,
];
