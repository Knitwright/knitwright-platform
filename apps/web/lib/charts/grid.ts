import { parseCsv } from "@/lib/sizing/csv";
import { CHART_IMPORT_LIMITS } from "./limits";

/**
 * A spreadsheet read as text. Every cell is a string, whatever the file said it was, so
 * nothing in it is ever run or worked out: a cell that starts with "=" is just text.
 * Each row keeps the line it has in the file, so a message can point to it.
 */
export interface GridRow {
  readonly line: number;
  readonly cells: readonly string[];
}
export type Grid = readonly GridRow[];

export type GridResult = { readonly ok: true; readonly grid: Grid } | { readonly ok: false; readonly message: string };

const { maxRows, maxColumns, maxCellLength } = CHART_IMPORT_LIMITS;

const isBlankRow = (cells: readonly string[]): boolean => cells.every((cell) => cell.trim() === "");

/** The number of columns once empty columns at the right edge are left out. */
function usedWidth(rows: readonly (readonly string[])[]): number {
  let width = 0;
  for (const cells of rows) {
    for (let index = cells.length - 1; index >= width; index -= 1) {
      if ((cells[index] ?? "").trim() !== "") {
        width = index + 1;
        break;
      }
    }
  }
  return width;
}

/** Checks the limits, then gives every row the same width. */
function toGrid(rows: readonly GridRow[]): GridResult {
  const kept = rows.filter((row) => !isBlankRow(row.cells));
  if (kept.length === 0) return { ok: false, message: "The file is empty. Put the chart on the first sheet." };
  if (kept.length > maxRows) {
    return { ok: false, message: `The file has ${kept.length} rows with something in them. A chart may have at most ${maxRows}.` };
  }
  const width = usedWidth(kept.map((row) => row.cells));
  if (width > maxColumns) {
    return { ok: false, message: `The file has ${width} columns. A chart may have at most ${maxColumns}.` };
  }
  for (const row of kept) {
    const long = row.cells.findIndex((cell) => cell.length > maxCellLength);
    if (long >= 0) {
      return {
        ok: false,
        message: `Line ${row.line}, column ${long + 1} is too long. A cell may hold at most ${maxCellLength} characters.`,
      };
    }
  }
  const grid = kept.map((row) => ({
    line: row.line,
    cells: Array.from({ length: width }, (_, index) => row.cells[index] ?? ""),
  }));
  return { ok: true, grid };
}

/** Reads the text of a CSV file. Quoting follows the usual rules; see lib/sizing/csv.ts. */
export function gridFromCsv(text: string): GridResult {
  const scanned = parseCsv(text);
  if (!scanned.ok) return { ok: false, message: scanned.message };
  return toGrid(scanned.records.map((record) => ({ line: record.line, cells: record.cells })));
}

function cellText(cell: unknown): string {
  if (typeof cell === "string") return cell;
  if (typeof cell === "number") return String(cell);
  if (typeof cell === "boolean") return cell ? "TRUE" : "FALSE";
  if (cell instanceof Date) return Number.isNaN(cell.getTime()) ? "" : cell.toISOString().slice(0, 10);
  return "";
}

/**
 * Reads the rows of the first sheet of a spreadsheet, as the reader gives them. Numbers
 * should arrive as the text stored in the file, so 52.5 stays exactly 52.5.
 */
export function gridFromSheet(rows: readonly (readonly unknown[])[]): GridResult {
  return toGrid(rows.map((cells, index) => ({ line: index + 1, cells: cells.map(cellText) })));
}
