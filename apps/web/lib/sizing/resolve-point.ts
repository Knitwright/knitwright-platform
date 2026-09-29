import {
  MEASUREMENT_MAX_TENTHS_MM,
  POINT_GROUP_LABELS,
  formatCm,
  type Measurement,
  type PointOfMeasure,
} from "@/lib/garment";
import type { GradedRow } from "./grading";
import { must } from "./invariant";
import type { ChartProvenance, MissingRow, ResolutionRow, SetRow } from "./resolution-types";

/**
 * Where a value is wanted. Sizes are matched by label. The two indexes point into the
 * size run of the chart, and are minus one when the chart does not have that label.
 */
export interface Where {
  readonly size: string;
  readonly baseSize: string;
  readonly sizeIndex: number;
  readonly baseIndex: number;
  /** Where the chart's own values come from. A platform chart only suggests them. */
  readonly chartProvenance?: ChartProvenance;
}

const section = (point: PointOfMeasure): { group: PointOfMeasure["group"]; groupLabel: string } => ({
  group: point.group,
  groupLabel: POINT_GROUP_LABELS[point.group],
});

const missing = (point: PointOfMeasure, message: string): MissingRow => ({
  status: "missing",
  pointId: point.id,
  label: point.label,
  ...section(point),
  message,
});

/**
 * A row when no chart can be used. A typed value is the value at the design base size and
 * nowhere else, because nothing can work it out for another size. When the design has no
 * sizes yet, there is only one size in play, so the value is shown as it is.
 * Its tolerance stays empty until someone confirms one.
 */
export function userOnlyRow(
  point: PointOfMeasure,
  user: Measurement | undefined,
  reason: string,
  size: string,
  baseSize: string | null,
): ResolutionRow {
  if (!user) return missing(point, `${point.label} has no value. ${reason} Type one in.`);
  if (baseSize !== null && size !== baseSize) {
    return missing(
      point,
      `${point.label} was typed in for size ${baseSize}. With no size chart it cannot be worked out for size ${size}. Type a value for this size.`,
    );
  }
  const where = baseSize === null ? "and sizes have not been set yet" : "";
  const which = baseSize === null ? "" : ` for size ${baseSize}`;
  return {
    status: "set",
    pointId: point.id,
    label: point.label,
    ...section(point),
    value: user.value,
    tolerance: null,
    provenance: user.provenance,
    note: `No size chart applies${where ? ` ${where}` : ""}, so this is the value that was typed in${which}, with no tolerance.`,
  };
}

function fromUser(point: PointOfMeasure, user: Measurement, chartRow: GradedRow | undefined, where: Where): ResolutionRow {
  const base: Omit<SetRow, "value" | "provenance" | "note"> = {
    status: "set",
    pointId: point.id,
    label: point.label,
    ...section(point),
    tolerance: chartRow?.tolerance ?? null,
  };
  const { size, baseSize } = where;
  if (size === baseSize) return { ...base, value: user.value, provenance: user.provenance, note: null };
  if (!chartRow) {
    return missing(
      point,
      `${point.label} was typed in for size ${baseSize}. The chart has no grade for it, so it cannot be worked out for size ${size}. Type a value for this size.`,
    );
  }
  if (where.sizeIndex < 0 || where.baseIndex < 0) {
    const absent = where.sizeIndex < 0 ? size : baseSize;
    return missing(
      point,
      `${point.label} cannot be worked out for size ${size} because the size chart has no size ${absent}. Type a value for this size.`,
    );
  }
  const atSize = must(chartRow.values[where.sizeIndex], `the chart value at size ${size}`).value;
  const atBase = must(chartRow.values[where.baseIndex], `the chart value at size ${baseSize}`).value;
  const value = user.value + atSize - atBase;
  if (value < 1 || value > MEASUREMENT_MAX_TENTHS_MM) {
    return missing(
      point,
      `${point.label} of ${formatCm(user.value)} cm at size ${baseSize} would come to ${formatCm(value)} cm at size ${size}, which is not possible. Type a value for this size.`,
    );
  }
  return {
    ...base,
    value,
    provenance: "derived",
    note: `Worked out from the ${formatCm(user.value)} cm typed in for size ${baseSize}, using the steps between sizes in the chart.`,
  };
}

/**
 * The value of one point at one size. The order is the chart, then the user. A value the
 * user set is the value at the design base size, and the other sizes are graded from it.
 */
export function resolvePoint(
  point: PointOfMeasure,
  user: Measurement | undefined,
  chartRow: GradedRow | undefined,
  where: Where,
): ResolutionRow {
  if (user) return fromUser(point, user, chartRow, where);
  if (chartRow && where.sizeIndex < 0) {
    return missing(
      point,
      `The size chart has no size ${where.size}, so ${point.label} is not filled in for it. Type a value for this size.`,
    );
  }
  const entry = chartRow?.values[where.sizeIndex];
  if (!chartRow || !entry) {
    return missing(point, `${point.label} is not in the size chart and has no typed value. Type one in.`);
  }
  return {
    status: "set",
    pointId: point.id,
    label: point.label,
    ...section(point),
    value: entry.value,
    tolerance: chartRow.tolerance,
    provenance: where.chartProvenance ?? "suggested-chart",
    note: null,
  };
}
