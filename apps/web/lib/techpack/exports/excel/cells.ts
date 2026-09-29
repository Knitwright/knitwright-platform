import type { CellObject } from "write-excel-file/node";
import { ExportRefused } from "../errors";

/**
 * Every cell of the Excel file is made here, by these few functions, and nowhere else. The
 * writer treats any plain object in the data as a cell, and a cell of the type "Formula" as a
 * formula. So nothing from the design, the user or the database is ever passed through as a
 * cell: text goes in as the `value` of a text cell, and a number as the `value` of a number
 * cell. No function here can make a formula.
 */

/** Text format, so a spreadsheet program never reads a string as a number, a date or a formula. */
const TEXT_FORMAT = "@";

/** Lengths show at least one decimal place, and two when the stored value has them. */
export const LENGTH_FORMAT = "0.0#";

export type SheetCell = CellObject | null;

/** A text cell. Empty text is no cell, because the writer writes no cell for it either. */
export function textCell(text: string): SheetCell {
  return text === "" ? null : { value: text, type: String, format: TEXT_FORMAT, wrap: true };
}

/** A sentence that runs across the sheet, so it does not wrap inside one column. */
export function noteCell(text: string): SheetCell {
  return text === "" ? null : { value: text, type: String, format: TEXT_FORMAT };
}

/** A bold heading above a table. */
export function titleCell(text: string): SheetCell {
  return text === "" ? null : { value: text, type: String, format: TEXT_FORMAT, fontWeight: "bold" };
}

/** A bold column header. */
export function headerCell(text: string): SheetCell {
  return text === "" ? null : { value: text, type: String, format: TEXT_FORMAT, fontWeight: "bold", wrap: true };
}

/** A number cell. A number that is not finite is refused, so a file never holds NaN. */
export function numberCell(number: number, format?: string): CellObject {
  if (!Number.isFinite(number)) throw new ExportRefused("A number in the Excel file is not finite.");
  return format === undefined ? { value: number, type: Number } : { value: number, type: Number, format };
}

const MAX_SHEET_NAME = 31;
const FORBIDDEN_IN_NAME = /[\\/?*[\]:]/;

/** Why a sheet name is not one Excel accepts, or null when it is. */
export function sheetNameProblem(name: string): string | null {
  if (name === "") return "A sheet name is empty.";
  if (name.length > MAX_SHEET_NAME) return `The sheet name "${name}" is longer than ${MAX_SHEET_NAME} characters.`;
  if (FORBIDDEN_IN_NAME.test(name)) return `The sheet name "${name}" holds a character Excel does not allow.`;
  if (name.startsWith("'") || name.endsWith("'")) return `The sheet name "${name}" starts or ends with a quote.`;
  return null;
}
