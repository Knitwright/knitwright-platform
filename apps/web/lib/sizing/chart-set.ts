import type { SizeChart, SizeRun } from "./schemas";

/** Size runs and the charts that use them. */
export interface ChartSet {
  readonly runs: readonly SizeRun[];
  readonly charts: readonly SizeChart[];
}
