import {
  POINT_GROUPS,
  POINT_GROUP_LABELS,
  formatCm,
  toleranceFor,
  type GarmentSpec,
  type PointOfMeasure,
  type Provenance,
  type Tolerance,
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
import { listOf } from "./text";
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

const toleranceCell = (tenthsMm: number, provenance: Provenance): LengthValue => ({
  status: "set",
  value: `±${formatCm(tenthsMm)}`,
  tenthsMm,
  provenance,
});

/**
 * The tolerance for a point. One a person typed is theirs, and stands even before any value
 * is filled in. Otherwise it comes from a size chart, so the chart's source is its source.
 */
function toleranceOf(typed: Tolerance | undefined, rows: readonly (ResolutionRow | undefined)[], source: ChartProvenance): LengthValue {
  if (typed) return toleranceCell(typed.value, typed.provenance);
  for (const row of rows) {
    if (row?.status === "set" && row.tolerance !== null) return toleranceCell(row.tolerance, source);
  }
  return TBC;
}

/** Stands for the size of the column in a note, while notes for several sizes are compared. */
const SIZE_SLOT = "\u0000";

const escaped = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The note with the words "size X" for its own column's size replaced by a slot, or as it is. */
const sizeTemplate = (text: string, size: string | null): string =>
  size === null ? text : text.replace(new RegExp(`\\bsize ${escaped(size)}(?![\\p{L}\\p{N}])`, "gu"), SIZE_SLOT);

/** One note for a group of sizes that were told the same thing, with the sizes named together. */
function sayOnce(template: string, sizes: readonly string[], first: string): string {
  if (sizes.length < 2 || !template.includes(SIZE_SLOT)) return first;
  return template.replaceAll(SIZE_SLOT, `sizes ${listOf(sizes)}`).replaceAll("this size", "these sizes");
}

/**
 * The notes of a row, each said once. Notes that differ only in the size of their column, such as
 * "it cannot be worked out for size XS" and the same for size S, are said once for all those sizes.
 */
function notesOf(rows: readonly (ResolutionRow | undefined)[], columns: readonly SizeColumn[]): string[] {
  const groups = new Map<string, { sizes: string[]; first: string }>();
  rows.forEach((row, index) => {
    const text = !row ? null : row.status === "missing" ? row.message : row.note;
    if (!text) return;
    const size = columns[index]?.size ?? null;
    const template = sizeTemplate(text, size);
    const group = groups.get(template) ?? { sizes: [], first: text };
    groups.set(template, { first: group.first, sizes: size === null ? group.sizes : [...group.sizes, size] });
  });
  return [...new Set([...groups].map(([template, group]) => sayOnce(template, group.sizes, group.first)))];
}

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
  typed: Tolerance | undefined,
): MeasureRow {
  const found = resolutions.map((resolution) => resolution.rows.find((row) => row.pointId === point.id));
  const baseFirst = [...found.slice(columns.findIndex((column) => column.isBase)), ...found];
  return {
    pointId: point.id,
    code,
    label: point.label,
    tolerance: toleranceOf(typed, columns.some((column) => column.isBase) ? baseFirst : found, chartSourceOf(resolutions)),
    values: found.map(lengthOf),
    notes: notesOf(found, columns),
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
    row: rowFor(point, codeFor(index), resolutions, columns, toleranceFor(spec, point.id)),
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
    onPattern: null,
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
