import writeExcelFile from "write-excel-file/node";
import type { TechPack } from "../../types";
import { ExportRefused } from "../errors";
import { assertEverySetCellHasSource } from "../guard";
import { exportSections } from "../tables";
import { sheetNameProblem, type SheetCell } from "./cells";
import { sheetOf } from "./sheet";

export interface WorkbookSheet {
  readonly name: string;
  readonly data: readonly (readonly SheetCell[])[];
  readonly columns?: readonly { readonly width: number }[];
  /** How many rows at the top stay in view while scrolling. */
  readonly frozenRows?: number;
}

const MIN_WIDTH = 10;
const MAX_WIDTH = 60;
const PADDING = 2;

/** The width of each column in characters: room for the longest text in it, within a least and a most. */
export function columnWidths(rows: readonly (readonly (string | number | null)[])[]): { width: number }[] {
  const count = rows.reduce((most, row) => Math.max(most, row.length), 0);
  return Array.from({ length: count }, (_, column) => {
    const longest = rows.reduce((most, row) => Math.max(most, String(row[column] ?? "").length), 0);
    return { width: Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, longest + PADDING)) };
  });
}

function assertSheetNames(sheets: readonly WorkbookSheet[]): void {
  const seen = new Set<string>();
  for (const { name } of sheets) {
    const problem = sheetNameProblem(name);
    if (problem) throw new ExportRefused(problem);
    if (seen.has(name.toLowerCase())) throw new ExportRefused(`The sheet name "${name}" is used twice.`);
    seen.add(name.toLowerCase());
  }
}

/** Writes the sheets to the bytes of an .xlsx file, in memory. Nothing is written to disk. */
export async function writeSheets(sheets: readonly WorkbookSheet[]): Promise<Uint8Array> {
  assertSheetNames(sheets);
  const written = await writeExcelFile(
    sheets.map((sheet) => ({
      data: sheet.data.map((row) => [...row]),
      sheet: sheet.name,
      ...(sheet.columns ? { columns: sheet.columns.map((column) => ({ ...column })) } : {}),
      ...(sheet.frozenRows ? { stickyRowsCount: sheet.frozenRows } : {}),
    })),
  ).toBuffer();
  return new Uint8Array(written);
}

/** The Excel file of a tech pack: one sheet for each section that holds values. */
export async function buildWorkbook(pack: TechPack): Promise<Uint8Array> {
  assertEverySetCellHasSource(pack);
  const sheets = exportSections(pack).flatMap((section) => {
    if (section.sheet === null) return [];
    const layout = sheetOf(section);
    return [{ name: section.sheet, data: layout.rows, columns: columnWidths(layout.measured), frozenRows: layout.frozenRows }];
  });
  return writeSheets(sheets);
}
