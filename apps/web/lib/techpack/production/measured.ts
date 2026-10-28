import { formatCm } from "@/lib/garment";
import type { PatternMeasurement, SizeLabelMap } from "@/lib/production/contract";
import { TBC, type LengthValue } from "../cell";
import type { MeasureRow, MeasurementsSection } from "../types";
import type { PatternOnlyTarget } from "./input";
import type { OnPatternCell, OnPatternRow, OnPatternTable, PatternOnlyRow } from "./types";

/** Names for the points only a pattern can give. An id not listed is named from the id itself. */
const PATTERN_ONLY_LABELS: Readonly<Record<string, string>> = {
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

function resultOf(measured: LengthValue, target: LengthValue, difference: LengthValue, tolerance: LengthValue): OnPatternCell["result"] {
  if (measured.status !== "set") return "not-measured";
  if (target.status !== "set" || difference.status !== "set") return "no-target";
  if (tolerance.status !== "set") return "no-tolerance";
  return Math.abs(difference.tenthsMm) > tolerance.tenthsMm ? "outside" : "inside";
}

function flagOf(result: OnPatternCell["result"], measured: LengthValue, target: LengthValue, difference: LengthValue, tolerance: LengthValue): string | null {
  if (result !== "outside" || measured.status !== "set" || target.status !== "set" || difference.status !== "set" || tolerance.status !== "set") return null;
  const way = difference.tenthsMm > 0 ? "over" : "under";
  return `Measured ${measured.value} cm on the pattern against a target of ${target.value} cm: ${formatCm(Math.abs(difference.tenthsMm))} cm ${way}, and the tolerance is ${tolerance.value} cm.`;
}

function cellFor(tolerance: LengthValue, target: LengthValue, size: string, measured: LengthValue): OnPatternCell {
  const difference = differenceOf(measured, target);
  const result = resultOf(measured, target, difference, tolerance);
  // The target is copied, so each cell of the document is its own object and none is listed twice.
  return { size, target: { ...target }, measured, difference, result, flag: flagOf(result, measured, target, difference, tolerance) };
}

const lengthOf = (tenthsMm: number, provenance: "user-edited" | "derived"): LengthValue => ({
  status: "set",
  value: formatCm(tenthsMm),
  tenthsMm,
  provenance,
});

function rowFor(row: MeasureRow, table: MeasurementsSection, find: (pointId: string, label: string) => PatternMeasurement | undefined): OnPatternRow {
  const cells = table.columns.flatMap((column, index) =>
    column.size === null ? [] : [cellFor(row.tolerance, row.values[index] ?? TBC, column.size, measuredCell(find(row.pointId, column.size)))],
  );
  return { pointId: row.pointId, code: row.code, label: row.label, tolerance: { ...row.tolerance }, cells };
}

function patternOnlyRows(
  measured: readonly PatternMeasurement[],
  targets: readonly PatternOnlyTarget[],
  known: ReadonlySet<string>,
  sizes: readonly string[],
): PatternOnlyRow[] {
  const ids = [...new Set(measured.map((m) => m.pointId))].filter((id) => !known.has(id));
  return ids.map((pointId) => {
    const own = measured.filter((m) => m.pointId === pointId);
    const given = targets.filter((t) => t.pointId === pointId);
    const tolerance = given[0] ? lengthOf(given[0].toleranceTenthsMm, "user-edited") : TBC;
    return {
      pointId,
      label: PATTERN_ONLY_LABELS[pointId] ?? humanised(pointId),
      method: own[0]?.method ?? "",
      tolerance,
      cells: sizes.map((size) => {
        const target = given.find((t) => t.size === size);
        return cellFor(tolerance, target ? lengthOf(target.targetTenthsMm, "user-edited") : TBC, size, measuredCell(own.find((m) => m.size === size)));
      }),
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
  patternOnlyTargets: readonly PatternOnlyTarget[] = [],
): OnPatternTable | null {
  if (measured.length === 0) return null;
  const labels = table.columns.flatMap((column) => (column.size === null ? [] : [column.size]));
  const find = (pointId: string, label: string) =>
    measured.find((m) => m.pointId === pointId && m.size === patternSizeOf(label, sizeMap));
  const tableRows = table.groups.flatMap((group) => group.rows);
  const rows = tableRows.map((row) => rowFor(row, table, find));
  const patternSizes = [...new Set(labels.map((label) => patternSizeOf(label, sizeMap)))];
  const patternOnly = patternOnlyRows(measured, patternOnlyTargets, new Set(tableRows.map((row) => row.pointId)), patternSizes);
  const cells = [...rows.flatMap((row) => row.cells), ...patternOnly.flatMap((row) => row.cells)];
  const outside = cells.filter((cell) => cell.result === "outside").length;
  const notMeasured = rows.flatMap((row) => row.cells).filter((cell) => cell.result === "not-measured").length;
  return {
    rows,
    patternOnly,
    outside,
    summary: summaryOf(outside, notMeasured),
  };
}
