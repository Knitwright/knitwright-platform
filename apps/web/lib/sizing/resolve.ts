import { pointsOfMeasureFor, sizeValueFor, toleranceFor, type GarmentSpec } from "@/lib/garment";
import type { ChartSet } from "./chart-set";
import { DEFAULT_CHART_SET, STARTER_CHART_NAME } from "./charts";
import { gradeChart, type GradedRow } from "./grading";
import { resolvePoint, userOnlyRow, type Typed } from "./resolve-point";
import type { ChartProvenance, Resolution, ResolutionRow, SizesFrom } from "./resolution-types";
import type { SizeChart } from "./schemas";
import { selectChart } from "./select-chart";

export type { Resolution, ResolutionRow } from "./resolution-types";

/** A platform chart only suggests its values. A brand's own chart supplies them. */
export const chartProvenanceOf = (chart: SizeChart): ChartProvenance =>
  chart.supplier === "brand" ? "brand-supplied" : "suggested-chart";

/** What a person typed for this point beyond its base size value. */
const typedFor = (spec: GarmentSpec, pointId: string, size: string): Typed => ({
  atSize: sizeValueFor(spec, pointId, size),
  tolerance: toleranceFor(spec, pointId),
});
const CHECK_WITH_FACTORY = "not a factory's numbers. Check them with your factory before you order.";

/** What to say about where a chart's values come from. A brand's own chart needs no warning. */
const chartNoteOf = (chart: SizeChart): string | null => {
  if (chart.supplier === "brand") return null;
  const from = chart.source.person === STARTER_CHART_NAME ? `the ${STARTER_CHART_NAME}` : "a Knitwright size chart";
  return `These measurements are suggestions from ${from}, ${CHECK_WITH_FACTORY}`;
};

function withoutChart(spec: GarmentSpec, size: string, message: string): Resolution {
  const rows: ResolutionRow[] = pointsOfMeasureFor(spec).map((point) =>
    userOnlyRow(
      point,
      spec.measurements.find((entry) => entry.pointId === point.id),
      message,
      size,
      spec.sizing?.baseSize ?? null,
      typedFor(spec, point.id, size),
    ),
  );
  return { status: "no-chart", message, size, rows };
}

type Where = Parameters<typeof resolvePoint>[3];

const unknownSize = (size: string, sizes: readonly string[], sizesFrom: SizesFrom): Resolution => ({
  status: "unknown-size",
  message: `"${size}" is not a size of this design. The sizes are ${sizes.join(", ")}.`,
  size,
  sizes,
  sizesFrom,
  rows: [],
});

/** One row per point of measure, with the chart row found by point. */
const resolvedRows = (spec: GarmentSpec, chartRows: readonly GradedRow[], where: Where): ResolutionRow[] =>
  pointsOfMeasureFor(spec).map((point) =>
    resolvePoint(
      point,
      spec.measurements.find((entry) => entry.pointId === point.id),
      chartRows.find((row) => row.pointId === point.id),
      where,
      typedFor(spec, point.id, where.size),
    ),
  );

/**
 * Every measurement that applies to a design, at one size. The order is the chart value
 * (suggested from a chart), then the chart for the design fit, then a value set on the
 * spec. A value set on the spec is the value at the design base size. When the design has
 * sizes, they are used, and chart values are found by size label. Otherwise the chart sizes
 * are used. A point with no value comes back as missing with a sentence, never as zero.
 * With no chart the answer says so and nothing is guessed. Inputs are never changed.
 */
export function resolveMeasurements(
  spec: GarmentSpec,
  size: string,
  chartSet: ChartSet = DEFAULT_CHART_SET,
): Resolution {
  const choice = selectChart(chartSet, spec);
  if (choice.kind === "none") return withoutChart(spec, size, choice.message);
  const { chart, run } = choice;
  const graded = gradeChart(chart, run);
  if (!graded.ok) {
    const first = graded.problems[0]?.message ?? "It has a problem.";
    return withoutChart(
      spec,
      size,
      `The size chart for ${chart.garmentType} for ${chart.wearer} cannot be used yet. ${first}`,
    );
  }
  const sizesFrom = spec.sizing ? "design" : "chart";
  const sizes = spec.sizing?.sizes ?? run.sizes;
  const baseSize = spec.sizing?.baseSize ?? chart.baseSize;
  if (!sizes.includes(size)) return unknownSize(size, sizes, sizesFrom);
  const where = {
    size,
    baseSize,
    sizeIndex: run.sizes.indexOf(size),
    baseIndex: run.sizes.indexOf(baseSize),
    chartProvenance: chartProvenanceOf(chart),
  };
  const rows = resolvedRows(spec, graded.rows, where);
  return {
    status: "resolved",
    size,
    baseSize,
    sizes,
    sizesFrom,
    sizesMissingFromChart: sizes.filter((label) => !run.sizes.includes(label)),
    chartFit: chart.fit,
    fitNote: choice.fitNote,
    source: chart.source,
    chartProvenance: where.chartProvenance,
    chartNote: chartNoteOf(chart),
    rows,
    message: null,
  };
}
