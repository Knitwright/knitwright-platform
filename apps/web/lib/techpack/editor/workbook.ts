import { headerCell, linkCell, noteCell, textCell, titleCell, type SheetCell } from "../exports/excel/cells";
import { columnWidths, writeSheets } from "../exports/excel/workbook";
import type { Sheet, SheetBlock, SheetsHeader, TechPackSheets } from "./sheets";

/**
 * The eight-sheet .xlsx of spec screen 31: one named sheet per tab of the sheets preview, each
 * opening with the shared header. It is written by the tech pack's existing Excel writer
 * (`writeSheets`), so it keeps that writer's rules: text cells only, never a formula, and the same
 * bytes for the same design.
 */

type Row = readonly SheetCell[];

const boldText = (text: string): SheetCell => (text === "" ? null : { ...textCell(text), fontWeight: "bold" } as SheetCell);

function headerRows(header: SheetsHeader, title: string): readonly Row[] {
  return [
    [titleCell(title.toUpperCase())],
    ...header.rows.map(([label, value]): Row => [headerCell(`${label}:`), textCell(value)]),
    [headerCell("Open in Knitwright"), linkCell(header.openIn)],
    [],
  ];
}

function blockRows(block: SheetBlock): readonly Row[] {
  const cell = (text: string, index: number) => (index === block.highlight ? boldText(text) : textCell(text));
  return [
    [titleCell(block.title.toUpperCase())],
    block.columns.map((column) => headerCell(column)),
    ...block.rows.map((row): Row => row.map(cell)),
    ...(block.note ? [[noteCell(block.note)]] : []),
    [],
  ];
}

const plain = (rows: readonly Row[]): readonly (readonly (string | null)[])[] =>
  rows.map((row) => row.map((entry) => (entry && typeof entry.value === "string" ? entry.value : null)));

function sheetRows(sheet: Sheet, header: SheetsHeader) {
  const rows = [...headerRows(header, sheet.title), ...sheet.blocks.flatMap(blockRows)];
  // The header's address and the notes run across the sheet, so they do not set a column's width.
  const measured = plain(sheet.blocks.flatMap((entry) => [entry.columns, ...entry.rows].map((row) => row.map(textCell))));
  return { name: sheet.name, data: rows, columns: columnWidths(measured), frozenRows: 0 };
}

export async function buildSheetsWorkbook(sheets: TechPackSheets): Promise<Uint8Array<ArrayBuffer>> {
  return writeSheets(sheets.sheets.map((entry) => sheetRows(entry, sheets.header)));
}
