import { readSheet } from "read-excel-file/node";
import { sheetKind } from "./container";
import { gridFromCsv, gridFromSheet, type GridResult } from "./grid";

const UNREADABLE = "The spreadsheet could not be read. Save it again as .xlsx or .csv and try again.";

/**
 * Reads a brand's chart file into a grid of text. The kind of file is judged from its
 * bytes. A spreadsheet is read with read-excel-file, which never runs a formula: a formula
 * cell gives the result the spreadsheet stored. Numbers are kept as the text stored in the
 * file, so no floating point rounding touches them. Nothing is thrown.
 */
export async function readChartFile(bytes: Uint8Array): Promise<GridResult> {
  const kind = sheetKind(bytes);
  if (!kind.ok) return { ok: false, message: kind.message };
  if (kind.kind === "csv") return gridFromCsv(kind.text);
  try {
    const rows = await readSheet<string>(Buffer.from(bytes), { parseNumber: (stored) => stored, trim: false });
    return gridFromSheet(rows);
  } catch {
    return { ok: false, message: UNREADABLE };
  }
}
