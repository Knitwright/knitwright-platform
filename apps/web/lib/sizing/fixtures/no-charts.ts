import type { ChartSet } from "../chart-set";

/**
 * Test support. No size charts at all, as the app was before the Knitwright starter charts.
 * A test that is about what happens with no chart passes this, rather than leaning on the
 * default charts, which now hold the starter charts.
 */
export const NO_CHART_SET: ChartSet = { runs: [], charts: [] };
