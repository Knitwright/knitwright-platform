import writeExcelFile from "write-excel-file/node";
import type { TechPack } from "../../types";
import { ExportRefused } from "../errors";
import { assertEverySetCellHasSource } from "../guard";
import { illustrationSheetRows, type ExportIllustrations } from "../illustrations";
import { exportSections } from "../tables";
import { tabPlan } from "../tabs";
import { noteCell, sheetNameProblem, type SheetCell } from "./cells";
import { sheetOfTab, type OpenInKnitwright } from "./sheet";

interface WorkbookSheet {
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
export async function writeSheets(sheets: readonly WorkbookSheet[]): Promise<Uint8Array<ArrayBuffer>> {
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

export interface WorkbookOptions {
  /** When AI pictures were made, a last sheet says so. The pictures themselves are only in the PDF. */
  readonly illustrations?: ExportIllustrations | null;
  /**
   * The address of this design in the editor, written into a cell at the top of every sheet
   * (spec F-S6). The caller passes it because only the caller knows which design and which
   * version this file is of; without it no sheet claims a link.
   */
  readonly openIn?: OpenInKnitwright | null;
}

const illustrationSheet = (illustrations: ExportIllustrations): WorkbookSheet => ({
  name: "Illustrations",
  data: illustrationSheetRows(illustrations).map((line) => [noteCell(line)]),
});

/** The Excel file of a tech pack: one sheet for each tab of the tech pack view (spec F-S6). */
export async function buildWorkbook(pack: TechPack, options: WorkbookOptions = {}): Promise<Uint8Array<ArrayBuffer>> {
  assertEverySetCellHasSource(pack);
  const sheets = tabPlan(exportSections(pack)).map((tab) => {
    const layout = sheetOfTab(tab, options.openIn ?? null);
    return { name: tab.sheet, data: layout.rows, columns: columnWidths(layout.measured), frozenRows: layout.frozenRows };
  });
  return writeSheets(options.illustrations ? [...sheets, illustrationSheet(options.illustrations)] : sheets);
}
