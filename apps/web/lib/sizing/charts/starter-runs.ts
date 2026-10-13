/**
 * The size runs of the Knitwright starter charts. Men run XS to 3XL and women XS to 2XL, as
 * the published sportswear charts in docs/sizing/starter-charts.md do. Youth use the youth
 * letter sizes of those charts: YXS is about age 4 to 5, YS 6 to 8, YM 10 to 12, YL 14 to 16
 * and YXL 18 to 20. The middle size is the base size the other sizes are graded from.
 */
import type { SizeRun } from "../schemas";

export const STARTER_MEN_RUN: SizeRun = { id: "starter-men", wearer: "men", sizes: ["XS", "S", "M", "L", "XL", "2XL", "3XL"] };

export const STARTER_WOMEN_RUN: SizeRun = { id: "starter-women", wearer: "women", sizes: ["XS", "S", "M", "L", "XL", "2XL"] };

export const STARTER_YOUTH_RUN: SizeRun = { id: "starter-youth", wearer: "youth", sizes: ["YXS", "YS", "YM", "YL", "YXL"] };

export const STARTER_RUNS: readonly SizeRun[] = [STARTER_MEN_RUN, STARTER_WOMEN_RUN, STARTER_YOUTH_RUN];

/** Each run with the size the chart values are given at. */
export const MEN = { id: STARTER_MEN_RUN.id, baseSize: "M" } as const;
export const WOMEN = { id: STARTER_WOMEN_RUN.id, baseSize: "M" } as const;
export const YOUTH = { id: STARTER_YOUTH_RUN.id, baseSize: "YM" } as const;
