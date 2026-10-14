/**
 * The public surface of the sizing library. Other code imports from here only.
 * It is pure: no React, no Next.js, no database, no network and no file access.
 */
export {
  AU_JUNIOR_RUN,
  AU_MEN_RUN,
  AU_RUNS,
  AU_WOMEN_RUN,
  DEFAULT_SIZE_LABEL_MAPS,
  JUNIOR_STARTER_COLUMN,
  cutsOfProduct,
  sizeMapReadiness,
  starterValuesFor,
  type CutOfProduct,
  type LabelValue,
  type LabelValues,
} from "./australia";
export { pointsAlwaysApplying, pointsThatCanApply } from "./applicable-points";
export { withBrandCharts, type BrandChart } from "./brand-charts";
export { chartCompleteness, type CompletenessEntry, type CompletenessReport } from "./completeness";
export { DEFAULT_CHARTS, DEFAULT_CHART_SET, DEFAULT_SIZE_RUNS, STARTER_CHART_NAME } from "./charts";
export { withChartValues } from "./chart-values";
export { type ChartSet } from "./chart-set";
export { editMeasurementAction, resetMeasurementAction, type EditResult, type Editor } from "./edit";
export {
  gradeChart,
  gradeValues,
  stepsFor,
  type ChartProblem,
  type GradedRow,
  type GradedValue,
  type GradeResult,
} from "./grading";
export { parseChartsCsv, type ParseProblem, type ParseResult } from "./parse-charts";
export { resolveMeasurements } from "./resolve";
export { resolveAllSizes, type AllSizesResolution, type SizeEntry } from "./resolve-all";
export { sizingFromChart, type SizingFromChartResult } from "./sizing-from-chart";
export type {
  ChartProvenance,
  MissingRow,
  NoChartResolution,
  Resolution,
  ResolutionRow,
  ResolvedResolution,
  SetRow,
  SizesFrom,
  UnknownSizeResolution,
} from "./resolution-types";
export {
  CHART_SUPPLIERS,
  FIT_CHOICES,
  chartPointSchema,
  chartSourceSchema,
  gradeSchema,
  sizeChartSchema,
  sizeRunSchema,
  type ChartPoint,
  type ChartSource,
  type Grade,
  type SizeChart,
  type SizeRun,
} from "./schemas";
export { parseSourceNote } from "./source-note";
export { buildChartSet, checkChart, chartKey, type ChartSetResult } from "./validate";
