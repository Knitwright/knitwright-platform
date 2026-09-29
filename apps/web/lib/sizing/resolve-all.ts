import type { GarmentSpec } from "@/lib/garment";
import type { ChartSet } from "./chart-set";
import { DEFAULT_CHART_SET } from "./charts";
import { resolveMeasurements } from "./resolve";
import type { Resolution, SizesFrom } from "./resolution-types";
import { selectChart } from "./select-chart";

export interface SizeEntry {
  readonly size: string;
  /** True for the base size of the design. */
  readonly isBase: boolean;
  readonly resolution: Resolution;
}

export interface AllSizesResolution {
  /** A plain sentence when nothing can be shown, otherwise null. */
  readonly message: string | null;
  readonly baseSize: string | null;
  readonly sizesFrom: SizesFrom | null;
  /** One entry for every size, smallest first. Empty when there are no sizes at all. */
  readonly entries: readonly SizeEntry[];
}

const EMPTY = (message: string): AllSizesResolution => ({ message, baseSize: null, sizesFrom: null, entries: [] });

/**
 * The resolution for every size of a design in one call, as the tech pack table needs.
 * The design sizes are used when it has them, and otherwise the sizes of the chart.
 */
export function resolveAllSizes(spec: GarmentSpec, chartSet: ChartSet = DEFAULT_CHART_SET): AllSizesResolution {
  let sizes: readonly string[];
  let baseSize: string;
  if (spec.sizing) {
    sizes = spec.sizing.sizes;
    baseSize = spec.sizing.baseSize;
  } else {
    const choice = selectChart(chartSet, spec);
    if (choice.kind === "none") return EMPTY(choice.message);
    sizes = choice.run.sizes;
    baseSize = choice.chart.baseSize;
  }
  const entries = sizes.map((size) => ({
    size,
    isBase: size === baseSize,
    resolution: resolveMeasurements(spec, size, chartSet),
  }));
  const first = entries[0]?.resolution;
  return {
    message: first?.status === "no-chart" ? first.message : null,
    baseSize,
    sizesFrom: spec.sizing ? "design" : "chart",
    entries,
  };
}
