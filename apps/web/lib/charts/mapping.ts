import { z } from "zod";
import { getType, wearerSchema, type PointOfMeasure, type ResolvedType } from "@/lib/garment";
import {
  checkChart,
  chartSourceSchema,
  pointsAlwaysApplying,
  pointsThatCanApply,
  sizeChartSchema,
  sizeRunSchema,
  type ChartPoint,
  type SizeChart,
  type SizeRun,
} from "@/lib/sizing";
import { FIT_CHOICES, MAX_SIZES_IN_RUN, SIZE_LABEL_MAX_LENGTH } from "@/lib/sizing/schemas";
import type { Grid, GridRow } from "./grid";
import { CHART_IMPORT_LIMITS } from "./limits";
import { CHART_UNITS, readChartUnit, type ChartUnit } from "./units";
import { readRowValues } from "./values";

/**
 * How the columns of a brand's file become a size chart. The person chooses the heading
 * row, the column that names each point of measure, the size columns, smallest first, and
 * the tolerance column. A row whose name is not recognised may be given a point, or left
 * out. Values are in centimetres or inches: the unit chosen on the screen, or the one named
 * in a units column for each row. The chart is stored in centimetres either way.
 */
const kebab = z
  .string()
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const column = z.number().int().min(0).max(CHART_IMPORT_LIMITS.maxColumns - 1);

export const chartMappingSchema = z.strictObject({
  wearer: wearerSchema,
  garmentType: kebab,
  fit: z.enum(FIT_CHOICES).nullable(),
  headerLine: z.number().int().min(1).max(1_000_000),
  pointColumn: column,
  sizeColumns: z.array(column).min(2, "Choose at least two size columns.").max(MAX_SIZES_IN_RUN),
  toleranceColumn: column,
  /** The unit of every value, unless a units column names another for its row. */
  units: z.enum(CHART_UNITS).default("cm"),
  /** A column naming each row's unit (cm or in). An empty cell uses `units`. */
  unitsColumn: column.nullable().default(null),
  baseSize: z.string().trim().min(1, "Choose the base size.").max(SIZE_LABEL_MAX_LENGTH),
  person: z
    .string()
    .trim()
    .min(1, "Name the person who produced the numbers.")
    .max(80)
    .refine((text) => !/\p{Cc}/u.test(text), "Remove line breaks and hidden characters."),
  rowPoints: z
    .array(z.strictObject({ line: z.number().int().min(1), pointId: kebab.nullable() }))
    .max(CHART_IMPORT_LIMITS.maxRows)
    .default([]),
});
export type ChartMapping = z.output<typeof chartMappingSchema>;

export interface MappingSuggestion {
  readonly headerLine: number;
  readonly pointColumn: number;
  readonly sizeColumns: readonly number[];
  readonly toleranceColumn: number | null;
  readonly units: ChartUnit;
  readonly unitsColumn: number | null;
  readonly baseSize: string;
}

export interface RowAssignment {
  readonly line: number;
  readonly label: string;
  readonly pointId: string | null;
  /** True when a person chose the point, or chose to leave the row out. */
  readonly chosen: boolean;
}

export type ImportResult =
  | { readonly ok: true; readonly chart: SizeChart; readonly run: SizeRun }
  | { readonly ok: false; readonly problems: readonly string[]; readonly missing: readonly string[] };

const POINT_HEADING = /point|measure|pom|description|name/i;
const TOLERANCE_HEADING = /tol/i;
const UNITS_HEADING = /^(units?|uom|unit of measure(ment)?)$/i;
/** A heading such as "Chest (in)" or "Inches" says the file is in inches. */
const INCH_HEADING = /\binch(es)?\b|\(ins?\)/i;

const normal = (text: string): string => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/** A first guess from the heading row, for the mapping screen to start from. */
export function suggestMapping(grid: Grid): MappingSuggestion {
  const header = grid[0];
  if (!header) return { headerLine: 1, pointColumn: 0, sizeColumns: [], toleranceColumn: null, units: "cm", unitsColumn: null, baseSize: "" };
  const cells = header.cells.map((cell) => cell.trim());
  const unitsAt = cells.findIndex((cell) => UNITS_HEADING.test(cell));
  const unitsColumn = unitsAt >= 0 ? unitsAt : null;
  const named = cells.findIndex((cell, index) => index !== unitsColumn && POINT_HEADING.test(cell));
  const pointColumn = named >= 0 ? named : 0;
  const tolerance = cells.findIndex((cell, index) => index !== pointColumn && index !== unitsColumn && TOLERANCE_HEADING.test(cell));
  const toleranceColumn = tolerance >= 0 ? tolerance : null;
  const sizeColumns = cells.flatMap((cell, index) =>
    index !== pointColumn && index !== toleranceColumn && index !== unitsColumn && cell !== "" && cell.length <= SIZE_LABEL_MAX_LENGTH
      ? [index]
      : [],
  );
  const middle = sizeColumns[Math.floor((sizeColumns.length - 1) / 2)];
  const units: ChartUnit = cells.some((cell) => INCH_HEADING.test(cell)) ? "in" : "cm";
  return {
    headerLine: header.line,
    pointColumn,
    sizeColumns,
    toleranceColumn,
    units,
    unitsColumn,
    baseSize: middle === undefined ? "" : (cells[middle] ?? ""),
  };
}

const matchPoint = (label: string, points: readonly PointOfMeasure[]): string | null => {
  const wanted = normal(label);
  if (wanted === "") return null;
  return points.find((point) => normal(point.id) === wanted || normal(point.label) === wanted)?.id ?? null;
};

const rowsAfterHeader = (grid: Grid, headerLine: number): readonly GridRow[] => grid.filter((row) => row.line > headerLine);

/** Which point each row below the heading row gives, matched by name unless a person chose. */
export function rowAssignments(grid: Grid, mapping: ChartMapping): readonly RowAssignment[] {
  const type = getType(mapping.garmentType);
  if (!type) return [];
  return rowsAfterHeader(grid, mapping.headerLine).map((row) => {
    const label = (row.cells[mapping.pointColumn] ?? "").trim();
    const choice = mapping.rowPoints.find((entry) => entry.line === row.line);
    return choice
      ? { line: row.line, label, pointId: choice.pointId, chosen: true }
      : { line: row.line, label, pointId: matchPoint(label, type.pointsOfMeasure), chosen: false };
  });
}

interface Frame {
  readonly type: ResolvedType;
  readonly sizes: readonly string[];
}

function columnProblems(mapping: ChartMapping, width: number): string[] {
  const problems: string[] = [];
  const used = [mapping.pointColumn, mapping.toleranceColumn, ...mapping.sizeColumns];
  for (const index of used) if (index >= width) problems.push(`Column ${index + 1} is not in the file.`);
  if (mapping.sizeColumns.includes(mapping.pointColumn)) problems.push("The column of point names is also chosen as a size column.");
  if (mapping.sizeColumns.includes(mapping.toleranceColumn)) problems.push("The tolerance column is also chosen as a size column.");
  if (mapping.pointColumn === mapping.toleranceColumn) problems.push("The column of point names is also chosen as the tolerance column.");
  if (new Set(mapping.sizeColumns).size !== mapping.sizeColumns.length) problems.push("A size column is chosen more than once.");
  return [...problems, ...unitsColumnProblems(mapping, width)];
}

function unitsColumnProblems(mapping: ChartMapping, width: number): string[] {
  const at = mapping.unitsColumn;
  if (at === null) return [];
  if (at >= width) return [`Column ${at + 1} is not in the file.`];
  if (mapping.sizeColumns.includes(at)) return ["The units column is also chosen as a size column."];
  if (at === mapping.pointColumn) return ["The units column is also chosen as the column of point names."];
  if (at === mapping.toleranceColumn) return ["The units column is also chosen as the tolerance column."];
  return [];
}

type RowUnit = { readonly ok: true; readonly unit: ChartUnit } | { readonly ok: false; readonly problem: string };

/** The unit of one row: its units cell when there is one, otherwise the unit chosen on the screen. */
function rowUnit(cells: readonly string[], mapping: ChartMapping, line: number): RowUnit {
  if (mapping.unitsColumn === null) return { ok: true, unit: mapping.units };
  const cell = (cells[mapping.unitsColumn] ?? "").trim();
  const read = readChartUnit(cell);
  if (!read.ok) {
    return {
      ok: false,
      problem: `Line ${line}: the unit "${cell}" is not one we read. Write cm or in, or leave the cell empty to use ${mapping.units === "in" ? "inches" : "centimetres"}.`,
    };
  }
  return { ok: true, unit: read.unit ?? mapping.units };
}

function sizeProblems(sizes: readonly string[], columns: readonly number[], baseSize: string): string[] {
  const problems: string[] = [];
  sizes.forEach((size, index) => {
    const where = `Column ${(columns[index] ?? 0) + 1}`;
    if (size === "") problems.push(`${where} has no size name in the heading row.`);
    else if (size.length > SIZE_LABEL_MAX_LENGTH) problems.push(`${where}: the size name "${size}" is longer than ${SIZE_LABEL_MAX_LENGTH} characters.`);
    else if (sizes.indexOf(size) !== index) problems.push(`The size ${size} appears more than once in the heading row.`);
  });
  if (!sizes.includes(baseSize.trim())) problems.push(`The base size ${baseSize.trim()} is not one of the size columns.`);
  return problems;
}

/** Checks everything that does not depend on the rows. */
function frameOf(grid: Grid, mapping: ChartMapping): { frame: Frame } | { problems: string[] } {
  const type = getType(mapping.garmentType);
  if (!type) return { problems: [`There is no garment type called ${mapping.garmentType}.`] };
  const header = grid.find((row) => row.line === mapping.headerLine);
  if (!header) return { problems: [`Line ${mapping.headerLine} is not in the file, so it cannot be the heading row.`] };
  const problems = columnProblems(mapping, header.cells.length);
  if (problems.length > 0) return { problems };
  const sizes = mapping.sizeColumns.map((index) => (header.cells[index] ?? "").trim());
  problems.push(...sizeProblems(sizes, mapping.sizeColumns, mapping.baseSize));
  const source = chartSourceSchema.safeParse({ person: mapping.person, date: "2000-01-01" });
  if (!source.success) problems.push(source.error.issues[0]?.message ?? "Name the person who produced the numbers.");
  return problems.length > 0 ? { problems } : { frame: { type, sizes } };
}

function readPoints(grid: Grid, mapping: ChartMapping, frame: Frame): { points: ChartPoint[]; problems: string[] } {
  const allowed = new Set(pointsThatCanApply(frame.type).map((point) => point.id));
  const labelOf = (id: string): string => frame.type.pointsOfMeasure.find((point) => point.id === id)?.label ?? id;
  const points: ChartPoint[] = [];
  const problems: string[] = [];
  const seen = new Map<string, number>();
  const rows = new Map(grid.map((row) => [row.line, row]));
  for (const assignment of rowAssignments(grid, mapping)) {
    const at = `Line ${assignment.line}`;
    if (assignment.pointId === null) {
      if (!assignment.chosen) {
        problems.push(
          assignment.label === ""
            ? `${at} has no point of measure name. Fill it in, or leave the row out.`
            : `${at}: "${assignment.label}" is not a point of measure we know. Choose which point it is, or leave the row out.`,
        );
      }
      continue;
    }
    const label = labelOf(assignment.pointId);
    if (!allowed.has(assignment.pointId)) {
      problems.push(`${at}: ${label} is not measured on a ${frame.type.label}. Leave the row out.`);
      continue;
    }
    const earlier = seen.get(assignment.pointId);
    if (earlier !== undefined) {
      problems.push(`${at}: ${label} is already given on line ${earlier}. Keep one.`);
      continue;
    }
    seen.set(assignment.pointId, assignment.line);
    const cells = rows.get(assignment.line)?.cells ?? [];
    const unit = rowUnit(cells, mapping, assignment.line);
    if (!unit.ok) {
      problems.push(unit.problem);
      continue;
    }
    const read = readRowValues(cells, { ...mapping, sizes: frame.sizes, label, line: assignment.line, unit: unit.unit });
    if (read.ok) points.push({ pointId: assignment.pointId, ...read.value });
    else problems.push(...read.problems);
  }
  return { points, problems };
}

const missingMessage = (missing: readonly string[]): string =>
  `The file has no row for ${missing.length === 1 ? "this point" : "these points"} of measure, so it cannot replace the chart: ${missing.join(", ")}. Add a row for each.`;

/**
 * Reads a brand's file through the mapping into a chart and its size run. The chart is the
 * brand's own, so its values are supplied by the brand. A file that lacks a point every
 * garment of the type has is refused, naming the point. Nothing is guessed: a value that
 * is not a plain number in its unit, or a unit other than cm or in, is refused, never worked
 * out. Inches are stored as centimetres, to the nearest tenth of a millimetre.
 */
export function applyMapping(grid: Grid, mapping: ChartMapping, today: string): ImportResult {
  const framed = frameOf(grid, mapping);
  if ("problems" in framed) return { ok: false, problems: framed.problems, missing: [] };
  const { frame } = framed;
  const { points, problems } = readPoints(grid, mapping, frame);
  const found = new Set(points.map((point) => point.pointId));
  const missing = pointsAlwaysApplying(frame.type)
    .filter((point) => !found.has(point.id))
    .map((point) => point.label);
  if (missing.length > 0 || problems.length > 0) {
    return { ok: false, problems: missing.length > 0 ? [missingMessage(missing), ...problems] : problems, missing };
  }
  return buildChart(mapping, frame, points, today);
}

function checkBuilt(chart: SizeChart, run: SizeRun): string[] {
  const runCheck = sizeRunSchema.safeParse(run);
  const chartCheck = sizeChartSchema.safeParse(chart);
  const problems = [
    ...(runCheck.success ? [] : runCheck.error.issues.map((issue) => issue.message)),
    ...(chartCheck.success ? [] : chartCheck.error.issues.map((issue) => issue.message)),
  ];
  return problems.length > 0 ? problems : checkChart(chart, run).map((found) => found.message);
}

function buildChart(mapping: ChartMapping, frame: Frame, points: readonly ChartPoint[], today: string): ImportResult {
  const run: SizeRun = {
    id: `brand-${mapping.wearer}-${mapping.garmentType}-${mapping.fit ?? "any"}`,
    wearer: mapping.wearer,
    sizes: frame.sizes,
  };
  const chart: SizeChart = {
    wearer: mapping.wearer,
    garmentType: mapping.garmentType,
    fit: mapping.fit,
    sizeRunId: run.id,
    baseSize: mapping.baseSize.trim(),
    points,
    source: { person: mapping.person.trim(), date: today },
    supplier: "brand",
  };
  const problems = checkBuilt(chart, run);
  return problems.length > 0 ? { ok: false, problems, missing: [] } : { ok: true, chart, run };
}
