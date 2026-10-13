/**
 * The default size charts that ship with the app: the Knitwright starter charts (owner
 * decision, 2026-10-13). There is one for every garment offered at launch and every wearer
 * it is made for, so a new design starts with sensible measurements. Their values are
 * suggestions to check with a factory, shown as suggested from a size chart. A brand's own
 * imported chart takes their place, and a value a person types always wins.
 *
 * Every number is a garment measurement laid flat, in centimetres, grounded in published
 * sportswear specifications. docs/sizing/starter-charts.md says where each one comes from.
 * A chart file here must never import from the fixtures folder, which holds made-up numbers
 * for tests. A test checks that.
 */
import type { ChartSet } from "../chart-set";
import type { SizeChart, SizeRun } from "../schemas";
import { STARTER_BOTTOMS } from "./starter-bottoms";
import { STARTER_CLOSE_FITTING } from "./starter-close-fitting";
import { STARTER_OUTERWEAR } from "./starter-outerwear";
import { STARTER_RUNS } from "./starter-runs";
import { STARTER_TOPS } from "./starter-tops";

export { STARTER_CHART_NAME } from "./starter-rows";

export const DEFAULT_SIZE_RUNS: readonly SizeRun[] = STARTER_RUNS;

export const DEFAULT_CHARTS: readonly SizeChart[] = [
  ...STARTER_TOPS,
  ...STARTER_BOTTOMS,
  ...STARTER_OUTERWEAR,
  ...STARTER_CLOSE_FITTING,
];

export const DEFAULT_CHART_SET: ChartSet = { runs: DEFAULT_SIZE_RUNS, charts: DEFAULT_CHARTS };
