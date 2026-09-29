/**
 * Test support: reads an Excel file back the way a person's spreadsheet program would, and
 * looks inside the zip for the raw XML. Nothing here is used by the app.
 */
import { strFromU8, unzipSync } from "fflate";
import readExcelFile from "read-excel-file/node";
import { TO_BE_CONFIRMED } from "../../cell";

export type Value = string | number | boolean | Date | null;
export interface ReadSheet {
  readonly sheet: string;
  readonly data: readonly (readonly Value[])[];
}

export const readWorkbook = async (bytes: Uint8Array): Promise<readonly ReadSheet[]> =>
  (await readExcelFile(Buffer.from(bytes))) as readonly ReadSheet[];

/** Every file inside the zip, as text. */
export const unzipText = (bytes: Uint8Array): Readonly<Record<string, string>> =>
  Object.fromEntries(Object.entries(unzipSync(new Uint8Array(bytes))).map(([name, content]) => [name, strFromU8(content)]));

export const worksheetXml = (bytes: Uint8Array): readonly string[] =>
  Object.entries(unzipText(bytes))
    .filter(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .map(([, xml]) => xml);

/** A value cell and the source beside it, as read back. */
export interface Pair {
  readonly value: Value;
  readonly source: Value;
}

const SOURCE_HEADER = /^.+ source$/;

const isHeaderRow = (row: readonly Value[]): boolean =>
  row.some((cell) => cell !== null) && row.every((cell) => cell === null || typeof cell === "string") &&
  row.some((cell) => typeof cell === "string" && SOURCE_HEADER.test(cell));

/**
 * Every value and the source in the column directly beside it. A column is a source column when
 * its header ends in " source", which every source column does, and its value is the column just
 * before it. A table on a sheet starts at the first row, or after a blank row.
 */
export function pairsOf(sheet: ReadSheet): readonly Pair[] {
  const pairs: Pair[] = [];
  let valueColumns: readonly number[] = [];
  for (const row of sheet.data) {
    if (isHeaderRow(row)) {
      valueColumns = row.flatMap((cell, index) => (typeof cell === "string" && SOURCE_HEADER.test(cell) ? [index - 1] : []));
    } else if (row.every((cell) => cell === null)) {
      valueColumns = [];
    } else {
      for (const column of valueColumns) pairs.push({ value: row[column] ?? null, source: row[column + 1] ?? null });
    }
  }
  return pairs;
}

export const TBC_WORDS = TO_BE_CONFIRMED;
