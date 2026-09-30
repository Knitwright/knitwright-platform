import { getType, type Wearer } from "@/lib/garment";
import { pointsThatCanApply } from "@/lib/sizing";
import type { FIT_CHOICES } from "@/lib/sizing/schemas";
import type { Grid } from "./grid";
import type { ChartUnit } from "./units";
import { chartMappingSchema, rowAssignments, type ChartMapping, type MappingSuggestion, type RowAssignment } from "./mapping";

/**
 * The state of the column mapping screen, and every change a control makes to it. Each
 * change gives a new state; nothing is changed in place. The component holds only markup.
 */
export interface ChartScreen {
  readonly wearer: Wearer;
  readonly garmentType: string;
  readonly fit: (typeof FIT_CHOICES)[number] | null;
  readonly headerLine: number;
  readonly pointColumn: number;
  readonly sizeColumns: readonly number[];
  readonly toleranceColumn: number | null;
  /** The unit of the values, unless the units column names another for a row. */
  readonly units: ChartUnit;
  readonly unitsColumn: number | null;
  readonly baseSize: string;
  readonly person: string;
  readonly rowPoints: readonly { readonly line: number; readonly pointId: string | null }[];
}

export const initialScreen = (suggestion: MappingSuggestion): ChartScreen => ({
  wearer: "men",
  garmentType: "crew-tee",
  fit: null,
  headerLine: suggestion.headerLine,
  pointColumn: suggestion.pointColumn,
  sizeColumns: suggestion.sizeColumns,
  toleranceColumn: suggestion.toleranceColumn,
  units: suggestion.units,
  unitsColumn: suggestion.unitsColumn,
  baseSize: suggestion.baseSize,
  person: "",
  rowPoints: [],
});

export interface ColumnChoice {
  readonly index: number;
  readonly label: string;
}

/** The columns of the heading row, named so a person can tell them apart. */
export function columnChoices(grid: Grid, headerLine: number): readonly ColumnChoice[] {
  const header = grid.find((row) => row.line === headerLine);
  if (!header) return [];
  return header.cells.map((cell, index) => ({ index, label: `Column ${index + 1}: ${cell.trim()}` }));
}

export function sizeLabels(grid: Grid, screen: ChartScreen): readonly string[] {
  const header = grid.find((row) => row.line === screen.headerLine);
  return screen.sizeColumns.map((index) => (header?.cells[index] ?? "").trim());
}

export function toggleSizeColumn(grid: Grid, screen: ChartScreen, index: number): ChartScreen {
  const on = screen.sizeColumns.includes(index);
  const sizeColumns = on
    ? screen.sizeColumns.filter((column) => column !== index)
    : [...screen.sizeColumns, index].sort((a, b) => a - b);
  const next = { ...screen, sizeColumns };
  return sizeLabels(grid, next).includes(screen.baseSize) ? next : { ...next, baseSize: "" };
}

/** "auto" goes back to matching the row by its name. Null leaves the row out. */
export function setRowPoint(screen: ChartScreen, line: number, pointId: string | null | "auto"): ChartScreen {
  const others = screen.rowPoints.filter((entry) => entry.line !== line);
  return { ...screen, rowPoints: pointId === "auto" ? others : [...others, { line, pointId }] };
}

const asMapping = (screen: ChartScreen, toleranceColumn: number): ChartMapping => ({ ...screen, toleranceColumn, sizeColumns: [...screen.sizeColumns], rowPoints: [...screen.rowPoints] });

export function rowPreview(grid: Grid, screen: ChartScreen): readonly RowAssignment[] {
  return rowAssignments(grid, asMapping(screen, screen.toleranceColumn ?? 0));
}

export function pointChoices(garmentType: string): readonly { readonly id: string; readonly label: string }[] {
  const type = getType(garmentType);
  return type ? pointsThatCanApply(type).map((point) => ({ id: point.id, label: point.label })) : [];
}

export type ScreenMapping = { readonly ok: true; readonly mapping: ChartMapping } | { readonly ok: false; readonly message: string };

/** The mapping to send, or the first thing still to fill in. */
export function toMapping(screen: ChartScreen): ScreenMapping {
  if (screen.toleranceColumn === null) {
    return { ok: false, message: "Choose the tolerance column. A chart needs a tolerance for every point of measure." };
  }
  const parsed = chartMappingSchema.safeParse(asMapping(screen, screen.toleranceColumn));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the choices above." };
  return { ok: true, mapping: parsed.data };
}
