import { TO_BE_CONFIRMED } from "../../cell";
import { ExportRefused } from "../errors";
import { sourceWords } from "../contents";
import type { Column, Datum, ExportSection, ExportTable } from "../tables";
import { LENGTH_FORMAT, headerCell, noteCell, numberCell, textCell, titleCell, type SheetCell } from "./cells";

/** One row of cells, and the plain values in it, which decide the column widths. */
export type Row = readonly SheetCell[];

export interface SheetLayout {
  readonly rows: readonly Row[];
  /** The rows of tables only, as plain text and numbers, for the column widths. */
  readonly measured: readonly (readonly (string | number | null)[])[];
  /** How many rows at the top stay in view: the title, the sentence and the header of the first table. */
  readonly frozenRows: number;
}

const sourceHeader = (column: Column): string => `${column.header} source`;

const unitHeader = (column: Column): string => {
  if (column.unit === undefined || column.unit === "") throw new ExportRefused(`The column "${column.header}" has no unit.`);
  return `${column.header} (${column.unit})`;
};

/** The header cells of one column. A value has its source in the cell directly beside it. */
function headersOf(column: Column): readonly string[] {
  switch (column.kind) {
    case "text":
      return [column.header];
    case "value":
      return [column.header, sourceHeader(column)];
    case "length":
    case "number":
      return [unitHeader({ ...column, unit: column.unit ?? (column.kind === "length" ? "cm" : undefined) }), sourceHeader(column)];
    case "class":
      return [column.header, sourceHeader(column), `${column.header} ISO number`, `${column.header} explanation`];
  }
}

const words = (text: string): SheetCell => textCell(text);

/** A cell that is to be confirmed: its words, and nothing beside it, so no source is claimed. */
const missing = (): readonly SheetCell[] => [words(TO_BE_CONFIRMED), null];

function cellsOf(column: Column, datum: Datum): readonly SheetCell[] {
  if (datum.kind !== column.kind) throw new ExportRefused(`A cell of kind ${datum.kind} is in a column of kind ${column.kind}.`);
  switch (datum.kind) {
    case "text":
      return [words(datum.text)];
    case "value":
      if (datum.cell === null) return [null, null];
      return datum.cell.status === "set" ? [words(datum.cell.value), words(sourceWords(datum.cell) ?? "")] : missing();
    case "length":
      return datum.cell.status === "set"
        ? [numberCell(datum.cell.tenthsMm / 100, LENGTH_FORMAT), words(sourceWords(datum.cell) ?? "")]
        : missing();
    case "number":
      return datum.cell.status === "set" ? [numberCell(datum.cell.number), words(sourceWords(datum.cell) ?? "")] : missing();
    case "class":
      return [words(datum.cell.value), words(sourceWords(datum.cell) ?? ""), words(datum.cell.iso), words(datum.cell.explanation)];
  }
}

const plain = (cell: SheetCell): string | number | null => {
  const found = cell?.value;
  return typeof found === "string" || typeof found === "number" ? found : null;
};

interface Block {
  readonly rows: readonly Row[];
  readonly measured: readonly (readonly (string | number | null)[])[];
  readonly frozen: number;
}

function tableBlock(table: ExportTable): Block {
  const heading: Row[] = [
    ...(table.title === null ? [] : [[titleCell(table.title)]]),
    ...(table.intro === null ? [] : [[noteCell(table.intro)]]),
  ];
  if (table.rows.length === 0) return { rows: heading, measured: [], frozen: 0 };
  const header: Row = table.columns.flatMap((column) => headersOf(column).map((text) => headerCell(text)));
  const data: Row[] = table.rows.map((row) => row.flatMap((datum, index) => cellsOf(table.columns[index] as Column, datum)));
  const body = [header, ...data];
  return { rows: [...heading, ...body], measured: body.map((row) => row.map(plain)), frozen: heading.length + 1 };
}

/** One sheet: the tables of a section one after another with a blank row between, then its notes by code, then its sentences. */
export function sheetOf(section: ExportSection): SheetLayout {
  const blocks = [...section.tables, ...(section.notes ?? [])].map(tableBlock);
  const tableRows = blocks.flatMap((block, index) => (index === 0 ? block.rows : [[], ...block.rows]));
  const sentences: Row[] = section.paragraphs.map((paragraph) => [noteCell(paragraph)]);
  const spacer: Row[] = tableRows.length > 0 && sentences.length > 0 ? [[]] : [];
  const rows = [...tableRows, ...spacer, ...sentences];
  return { rows, measured: blocks.flatMap((block) => block.measured), frozenRows: blocks[0]?.frozen ?? 0 };
}
