import { z } from "zod";
import { getType } from "@/lib/garment";
import { chartKey, sizeChartSchema, sizeRunSchema, type BrandChart } from "@/lib/sizing";

/** The columns of a stored chart that are read back. */
const storedRow = z.object({ chart: z.unknown(), run: z.unknown() });

/**
 * A chart read back from the database, checked again with the sizing schemas. A row that
 * does not match is left out rather than trusted. A stored chart is always the brand's own.
 */
export function brandChartFromRow(row: unknown): BrandChart | null {
  const parsed = storedRow.safeParse(row);
  if (!parsed.success) return null;
  const chart = sizeChartSchema.safeParse(parsed.data.chart);
  const run = sizeRunSchema.safeParse(parsed.data.run);
  if (!chart.success || !run.success || chart.data.sizeRunId !== run.data.id) return null;
  return { run: run.data, chart: { ...chart.data, supplier: "brand" } };
}

interface ChartSummary {
  readonly key: string;
  readonly garment: string;
  readonly wearer: string;
  readonly fit: string;
  readonly sizes: string;
  readonly baseSize: string;
  readonly points: number;
  readonly source: string;
}

/** A stored chart in plain words, for the list on the charts page. */
export function chartSummary({ chart, run }: BrandChart): ChartSummary {
  return {
    key: chartKey(chart),
    garment: getType(chart.garmentType)?.label ?? chart.garmentType,
    wearer: chart.wearer,
    fit: chart.fit === null ? "Every fit" : `${chart.fit.charAt(0).toUpperCase()}${chart.fit.slice(1)}`,
    sizes: run.sizes.join(", "),
    baseSize: chart.baseSize,
    points: chart.points.length,
    source: `${chart.source.person}, ${chart.source.date}`,
  };
}
