import { formatCm } from "@/lib/garment";
import type { PatternMeasurement, SizeLabelMap } from "@/lib/production/contract";
import { TBC, type LengthValue } from "../cell";
import type { MeasureRow, MeasurementsSection } from "../types";
import type { OnPatternCell, OnPatternRow, OnPatternTable, PatternOnlyRow } from "./types";

/** Names for the points only a pattern can give. An id not listed is named from the id itself. */
export const PATTERN_ONLY_LABELS: Readonly<Record<string, string>> = {
  "cap-height": "Sleeve cap height",
  "armhole-curve": "Armhole curve, front and back",
  "cap-curve": "Sleeve cap curve",
  "cap-ease": "Sleeve cap ease",
  "neckline-length": "Neckline, full length",
  "collar-cut-length": "Collar cut length",
  "across-back": "Across back",
};

const humanised = (id: string): string => {
  const words = id.replaceAll("-", " ");
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
};

/** The pattern size a size label is cut from. A label without a map entry is read as the pattern size of the same name. */
export const patternSizeOf = (label: string, sizeMap: readonly SizeLabelMap[]): string =>
  sizeMap.find((entry) => entry.label === label)?.patternSize ?? label;

const measuredCell = (m: PatternMeasurement | undefined): LengthValue =>
  m === undefined ? TBC : { status: "set", value: formatCm(m.tenthsMm), tenthsMm: m.tenthsMm, provenance: "measured-from-pattern" };

const signed = (tenthsMm: number): string => `${tenthsMm > 0 ? "+" : tenthsMm < 0 ? "-" : ""}${formatCm(Math.abs(tenthsMm))}`;

function differenceOf(measured: LengthValue, target: LengthValue): LengthValue {
  if (measured.status !== "set" || target.status !== "set") return TBC;
  const tenthsMm = measured.tenthsMm - target.tenthsMm;
  return { status: "set", value: signed(tenthsMm), tenthsMm, provenance: "derived" };
}

function statusOf(measured: LengthValue, target: LengthValue, difference: LengthValue, tolerance: LengthValue): OnPatternCell["status"] {
  if (measured.status !== "set") return "not-measured";
  if (target.status !== "set" || difference.status !== "set") return "no-target";
  if (tolerance.status !== "set") return "no-tolerance";
  return Math.abs(difference.tenthsMm) > tolerance.tenthsMm ? "outside" : "inside";
}

function flagOf(status: OnPatternCell["status"], measured: LengthValue, target: LengthValue, difference: LengthValue, tolerance: LengthValue): string | null {
  if (status !== "outside" || measured.status !== "set" || target.status !== "set" || difference.status !== "set" || tolerance.status !== "set") return null;
  const way = difference.tenthsMm > 0 ? "over" : "under";
  return `Measured ${measured.value} cm on the pattern against a target of ${target.value} cm: ${formatCm(Math.abs(difference.tenthsMm))} cm ${way}, and the tolerance is ${tolerance.value} cm.`;
}

function cellFor(row: MeasureRow, index: number, size: string, measured: LengthValue): OnPatternCell {
  const target = row.values[index] ?? TBC;
  const difference = differenceOf(measured, target);
  const status = statusOf(measured, target, difference, row.tolerance);
  return { size, target, measured, difference, status, flag: flagOf(status, measured, target, difference, row.tolerance) };
}

function rowFor(row: MeasureRow, table: MeasurementsSection, find: (pointId: string, label: string) => PatternMeasurement | undefined): OnPatternRow {
  const cells = table.columns.flatMap((column, index) =>
    column.size === null ? [] : [cellFor(row, index, column.size, measuredCell(find(row.pointId, column.size)))],
  );
  return { pointId: row.pointId, code: row.code, label: row.label, tolerance: row.tolerance, cells };
}

function patternOnlyRows(measured: readonly PatternMeasurement[], known: ReadonlySet<string>, sizes: readonly string[]): PatternOnlyRow[] {
  const ids = [...new Set(measured.map((m) => m.pointId))].filter((id) => !known.has(id));
  return ids.map((pointId) => {
    const own = measured.filter((m) => m.pointId === pointId);
    return {
      pointId,
      label: PATTERN_ONLY_LABELS[pointId] ?? humanised(pointId),
      method: own[0]?.method ?? "",
      cells: sizes.map((size) => ({ size, measured: measuredCell(own.find((m) => m.size === size)) })),
    };
  });
}

const summaryOf = (outside: number, notMeasured: number): string => {
  const out = outside === 0 ? "No measurement is outside its tolerance." : `${outside} ${outside === 1 ? "measurement is" : "measurements are"} outside the tolerance.`;
  return notMeasured === 0 ? out : `${out} ${notMeasured} ${notMeasured === 1 ? "value has" : "values have"} not been measured on the pattern.`;
};

/**
 * The measurement table set against the pattern. For each point and size it gives the target, the
 * value measured on that size's pattern, the difference, and whether it is inside the tolerance.
 * Nothing is measured here: the values come from the pattern library. Without a pattern there is no table.
 */
export function buildOnPattern(
  table: MeasurementsSection,
  measured: readonly PatternMeasurement[],
  sizeMap: readonly SizeLabelMap[],
): OnPatternTable | null {
  if (measured.length === 0) return null;
  const labels = table.columns.flatMap((column) => (column.size === null ? [] : [column.size]));
  const find = (pointId: string, label: string) =>
    measured.find((m) => m.pointId === pointId && m.size === patternSizeOf(label, sizeMap));
  const tableRows = table.groups.flatMap((group) => group.rows);
  const rows = tableRows.map((row) => rowFor(row, table, find));
  const cells = rows.flatMap((row) => row.cells);
  const outside = cells.filter((cell) => cell.status === "outside").length;
  const notMeasured = cells.filter((cell) => cell.status === "not-measured").length;
  const patternSizes = [...new Set(labels.map((label) => patternSizeOf(label, sizeMap)))];
  return {
    rows,
    patternOnly: patternOnlyRows(measured, new Set(tableRows.map((row) => row.pointId)), patternSizes),
    outside,
    summary: summaryOf(outside, notMeasured),
  };
}
