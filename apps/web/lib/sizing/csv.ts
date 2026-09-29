/** One row of a CSV file, with the line it starts on. Line 1 is the first line. */
export interface CsvRecord {
  readonly line: number;
  readonly cells: readonly string[];
}

export type CsvResult =
  | { readonly ok: true; readonly records: readonly CsvRecord[] }
  | { readonly ok: false; readonly line: number; readonly message: string };

const BYTE_ORDER_MARK = "﻿";

interface Scan {
  cells: string[];
  cell: string;
  inQuotes: boolean;
  /** True once anything has been read into the current cell, even an empty pair of quotes. */
  started: boolean;
  recordLine: number;
  line: number;
}

const isBlank = (cells: readonly string[]): boolean => cells.length === 1 && cells[0] === "";

/**
 * Splits CSV text into rows. It handles quoted cells, commas and line breaks inside
 * quotes, doubled quotes, Windows line endings, a byte order mark and blank lines.
 * Nothing is read from disk. The text comes in and rows go out.
 */
export function parseCsv(input: string): CsvResult {
  const text = input.startsWith(BYTE_ORDER_MARK) ? input.slice(1) : input;
  const records: CsvRecord[] = [];
  const scan: Scan = { cells: [], cell: "", inQuotes: false, started: false, recordLine: 1, line: 1 };

  const endCell = (): void => {
    scan.cells.push(scan.cell);
    scan.cell = "";
    scan.started = false;
  };
  const endRecord = (): void => {
    endCell();
    if (!isBlank(scan.cells)) records.push({ line: scan.recordLine, cells: scan.cells });
    scan.cells = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text.charAt(index);
    if (scan.inQuotes) {
      if (char === '"' && text.charAt(index + 1) === '"') {
        scan.cell += '"';
        index += 1;
      } else if (char === '"') {
        scan.inQuotes = false;
      } else {
        if (char === "\n") scan.line += 1;
        scan.cell += char;
      }
    } else if (char === '"') {
      if (scan.started) {
        return { ok: false, line: scan.line, message: `Line ${scan.line} has a quote in the middle of a cell. Put the whole cell in quotes, or remove the quote.` };
      }
      scan.inQuotes = true;
      scan.started = true;
    } else if (char === ",") {
      endCell();
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text.charAt(index + 1) === "\n") index += 1;
      endRecord();
      scan.line += 1;
      scan.recordLine = scan.line;
    } else {
      scan.cell += char;
      scan.started = true;
    }
  }
  if (scan.inQuotes) {
    return { ok: false, line: scan.recordLine, message: `Line ${scan.recordLine} opens a quote that is never closed. Add the closing quote.` };
  }
  if (scan.started || scan.cells.length > 0 || scan.cell !== "") endRecord();
  return { ok: true, records };
}
