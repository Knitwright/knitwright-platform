import {
  POINT_GROUPS,
  POINT_GROUP_LABELS,
  formatCm,
  type GarmentSpec,
  type PointOfMeasure,
} from "@/lib/garment";
import {
  resolveAllSizes,
  resolveMeasurements,
  type ChartProvenance,
  type ChartSet,
  type Resolution,
  type ResolutionRow,
} from "@/lib/sizing";
import { TBC } from "./cell";
import { codeFor, pointsInTableOrder } from "./codes";
import type {
  HowToMeasureSection,
  LengthValue,
  MeasureGroup,
  MeasureRow,
  MeasurementsSection,
  SizeColumn,
} from "./types";
import { SECTION_TITLES } from "./types";

const NO_SIZES = "No sizes have been set yet. Set the sizes so each measurement can be given for a size.";
const SOME_MISSING = "Some measurements are still to be confirmed.";
const NOT_SET_LABEL = "Size not set";

function lengthOf(row: ResolutionRow | undefined): LengthValue {
  if (!row || row.status === "missing") return TBC;
  return { status: "set", value: formatCm(row.value), tenthsMm: row.value, provenance: row.provenance };
}

/** The tolerance for a point. It only ever comes from a size chart, so the chart's source is its source. */
function toleranceOf(rows: readonly (ResolutionRow | undefined)[], source: ChartProvenance): LengthValue {
  for (const row of rows) {
    if (row?.status === "set" && row.tolerance !== null) {
      return { status: "set", value: `±${formatCm(row.tolerance)}`, tenthsMm: row.tolerance, provenance: source };
    }
  }
  return TBC;
}

const notesOf = (rows: readonly (ResolutionRow | undefined)[]): string[] => {
  const notes = rows.flatMap((row) => {
    if (!row) return [];
    const text = row.status === "missing" ? row.message : row.note;
    return text ? [text] : [];
  });
  return [...new Set(notes)];
};

const chartSourceOf = (resolutions: readonly Resolution[]): ChartProvenance =>
  resolutions.flatMap((resolution) => (resolution.status === "resolved" ? [resolution.chartProvenance] : []))[0] ??
  "suggested-chart";

/** The chart's own note, which says a platform chart's values are suggestions to check with the factory. */
const chartNoteOf = (resolutions: readonly Resolution[]): string | null =>
  resolutions.flatMap((resolution) => (resolution.status === "resolved" ? [resolution.chartNote] : []))[0] ?? null;

function rowFor(
  point: PointOfMeasure,
  code: string,
  resolutions: readonly Resolution[],
  columns: readonly SizeColumn[],
): MeasureRow {
  const found = resolutions.map((resolution) => resolution.rows.find((row) => row.pointId === point.id));
  const baseFirst = [...found.slice(columns.findIndex((column) => column.isBase)), ...found];
  return {
    pointId: point.id,
    code,
    label: point.label,
    tolerance: toleranceOf(columns.some((column) => column.isBase) ? baseFirst : found, chartSourceOf(resolutions)),
    values: found.map(lengthOf),
    notes: notesOf(found),
  };
}

/**
 * The measurement table for the whole size run: a row for each point of measure in registry
 * order, grouped by section, a column for each size with the base size marked. It is made from
 * `resolveAllSizes`, the same call the editor table uses, so the two cannot disagree. A value
 * that is missing is to be confirmed, and is never a number or a zero.
 */
export function buildMeasurements(spec: GarmentSpec, charts?: ChartSet): MeasurementsSection {
  const all = resolveAllSizes(spec, charts);
  const hasSizes = all.entries.length > 0;
  const columns: readonly SizeColumn[] = hasSizes
    ? all.entries.map((entry) => ({ size: entry.size, label: entry.size, isBase: entry.isBase }))
    : [{ size: null, label: NOT_SET_LABEL, isBase: false }];
  const resolutions = hasSizes ? all.entries.map((entry) => entry.resolution) : [resolveMeasurements(spec, "", charts)];
  const rows = pointsInTableOrder(spec).map((point, index) => ({
    group: point.group,
    row: rowFor(point, codeFor(index), resolutions, columns),
  }));
  const groups: readonly MeasureGroup[] = POINT_GROUPS.map((group) => ({
    group,
    label: POINT_GROUP_LABELS[group],
    rows: rows.filter((entry) => entry.group === group).map((entry) => entry.row),
  })).filter((group) => group.rows.length > 0);
  const missing = groups.some((group) => group.rows.some((row) => row.values.some((value) => value.status !== "set")));
  const note = !hasSizes ? NO_SIZES : missing ? SOME_MISSING : chartNoteOf(resolutions);
  return {
    id: "measurements",
    title: SECTION_TITLES.measurements,
    note,
    columns,
    groups,
    sizesFrom: hasSizes ? all.sizesFrom : null,
  };
}

/** For each point of measure: its code, its label and the sentence from the registry that says how to take it. */
export function buildHowToMeasure(spec: GarmentSpec): HowToMeasureSection {
  const rows = pointsInTableOrder(spec).map((point, index) => ({
    pointId: point.id,
    code: codeFor(index),
    label: point.label,
    howToMeasure: point.howToMeasure,
  }));
  return {
    id: "how-to-measure",
    title: SECTION_TITLES["how-to-measure"],
    note: rows.length === 0 ? "This garment type has no measurements to explain." : null,
    rows,
  };
}
