import type { GarmentSpec, Measurement } from "@/lib/garment";
import type { ChartSet } from "./chart-set";
import { DEFAULT_CHART_SET } from "./charts";
import { resolveMeasurements } from "./resolve";
import { resolveAllSizes } from "./resolve-all";

/**
 * The design with the chart's value at its base size added for every point it has no value
 * for, each marked with where it came from. It is for reading only, such as for the assistant,
 * so that "2 cm longer" can start from the value the person sees. It is never saved. A value
 * on the design is kept as it is. With no chart, the design comes back unchanged.
 */
export function withChartValues(spec: GarmentSpec, chartSet: ChartSet = DEFAULT_CHART_SET): GarmentSpec {
  const baseSize = resolveAllSizes(spec, chartSet).baseSize;
  if (baseSize === null) return spec;
  const resolution = resolveMeasurements(spec, baseSize, chartSet);
  if (resolution.status !== "resolved") return spec;
  const own = new Set(spec.measurements.map((entry) => entry.pointId));
  const added: Measurement[] = resolution.rows.flatMap((row) =>
    row.status === "set" && !own.has(row.pointId) ? [{ pointId: row.pointId, value: row.value, provenance: row.provenance }] : [],
  );
  return added.length === 0 ? spec : { ...spec, measurements: [...spec.measurements, ...added] };
}
