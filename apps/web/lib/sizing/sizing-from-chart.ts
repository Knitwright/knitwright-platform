import type { GarmentSpec, SpecAction } from "@/lib/garment";
import type { ChartSet } from "./chart-set";
import { DEFAULT_CHART_SET } from "./charts";
import { selectChart } from "./select-chart";

type SizingFromChartResult =
  | { readonly ok: true; readonly action: Extract<SpecAction, { type: "set-sizing" }> }
  | { readonly ok: false; readonly reason: string };

/**
 * The set-sizing action that gives a new design the sizes and base size of the chart
 * that applies to it. A design that already has sizing is left alone. With no chart, the
 * answer is a plain reason and nothing is made up.
 */
export function sizingFromChart(spec: GarmentSpec, chartSet: ChartSet = DEFAULT_CHART_SET): SizingFromChartResult {
  if (spec.sizing) return { ok: false, reason: "This design already has its sizes." };
  const choice = selectChart(chartSet, spec);
  if (choice.kind === "none") return { ok: false, reason: choice.message };
  return {
    ok: true,
    action: {
      type: "set-sizing",
      sizing: { sizes: [...choice.run.sizes], baseSize: choice.chart.baseSize },
    },
  };
}
