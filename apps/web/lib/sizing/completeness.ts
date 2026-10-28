import { listTypes, type Wearer } from "@/lib/garment";
import type { ChartSet } from "./chart-set";
import { DEFAULT_CHART_SET } from "./charts";
import type { SizeChart } from "./schemas";

interface CompletenessEntry {
  readonly typeId: string;
  readonly typeLabel: string;
  readonly wearer: Wearer;
  /** True when a chart and its size run are both on file. */
  readonly hasChart: boolean;
  /** The fits the charts on file are made for. Null means a chart used for every fit. */
  readonly fits: readonly SizeChart["fit"][];
  readonly message: string;
}

interface CompletenessReport {
  readonly entries: readonly CompletenessEntry[];
  readonly withChart: number;
  readonly complete: boolean;
  readonly summary: string;
}

function entryFor(set: ChartSet, typeId: string, typeLabel: string, wearer: Wearer): CompletenessEntry {
  const charts = set.charts.filter(
    (chart) =>
      chart.garmentType === typeId &&
      chart.wearer === wearer &&
      set.runs.some((run) => run.id === chart.sizeRunId),
  );
  const fits = charts.map((chart) => chart.fit);
  const hasChart = charts.length > 0;
  const message = hasChart
    ? `A size chart is on file for ${typeLabel} for ${wearer}: ${fits.map((fit) => fit ?? "every fit").join(", ")}.`
    : `No size chart yet for ${typeLabel} for ${wearer}.`;
  return { typeId, typeLabel, wearer, hasChart, fits, message };
}

/**
 * For every garment type and wearer in the registry, says whether a chart exists.
 * With no argument it looks at the default charts that ship with the app, so the app
 * and the owner can see what is still missing.
 */
export function chartCompleteness(set: ChartSet = DEFAULT_CHART_SET): CompletenessReport {
  const entries = listTypes().flatMap((type) =>
    type.wearers.map((wearer) => entryFor(set, type.id, type.label, wearer)),
  );
  const withChart = entries.filter((entry) => entry.hasChart).length;
  const missing = entries.length - withChart;
  return {
    entries,
    withChart,
    complete: missing === 0,
    summary: `${withChart} of ${entries.length} garment and wearer pairs have a size chart. ${missing} still need one.`,
  };
}
