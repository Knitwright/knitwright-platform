/**
 * The default size charts that ship with the app.
 *
 * There are none yet. The charts arrive with owner action A5, when the owner sends the
 * numbers. See docs/owner/size-charts.md for exactly what to send. A chart file added
 * here must name a real person and a date as its source, and must never import from
 * the fixtures folder, which holds made-up numbers for tests. Tests check both.
 */
import type { ChartSet } from "../chart-set";
import type { SizeChart, SizeRun } from "../schemas";

export const DEFAULT_SIZE_RUNS: readonly SizeRun[] = [];

export const DEFAULT_CHARTS: readonly SizeChart[] = [];

export const DEFAULT_CHART_SET: ChartSet = { runs: DEFAULT_SIZE_RUNS, charts: DEFAULT_CHARTS };
