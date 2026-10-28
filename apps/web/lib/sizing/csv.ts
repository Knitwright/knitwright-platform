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
  /** True right after a closing quote, when only a comma, a line break or the end may follow. */
  closed: boolean;
  recordLine: number;
  line: number;
}

const CELL_ENDERS = ",\r\n";

const isBlank = (cells: readonly string[]): boolean => cells.length === 1 && cells[0] === "";

type Failure = Extract<CsvResult, { ok: false }>;

const failure = (line: number, message: string): Failure => ({ ok: false, line, message });

const endCell = (scan: Scan): void => {
  scan.cells.push(scan.cell);
  scan.cell = "";
  scan.started = false;
  scan.closed = false;
};

const endRecord = (scan: Scan, records: CsvRecord[]): void => {
  endCell(scan);
  if (!isBlank(scan.cells)) records.push({ line: scan.recordLine, cells: scan.cells });
  scan.cells = [];
};

/** Reads one character inside quotes. Returns the index of the last character used. */
function readQuoted(scan: Scan, text: string, index: number): number {
  const char = text.charAt(index);
  if (char === '"' && text.charAt(index + 1) === '"') {
    scan.cell += '"';
    return index + 1;
  }
  if (char === '"') {
    scan.inQuotes = false;
    scan.closed = true;
    return index;
  }
  // A Windows line break is counted once, at its line feed. A lone carriage return counts here.
  if (char === "\n" || (char === "\r" && text.charAt(index + 1) !== "\n")) scan.line += 1;
  scan.cell += char;
  return index;
}

/** Reads one character outside quotes. Returns the index of the last character used, or what is wrong. */
function readPlain(scan: Scan, records: CsvRecord[], text: string, index: number): number | Failure {
  const char = text.charAt(index);
  if (scan.closed && !CELL_ENDERS.includes(char)) {
    return failure(scan.line, `Line ${scan.line} has text after a closing quote. Put a comma after the closing quote, or remove the extra text.`);
  }
  if (char === '"') {
    if (scan.started) return failure(scan.line, `Line ${scan.line} has a quote in the middle of a cell. Put the whole cell in quotes, or remove the quote.`);
    scan.inQuotes = true;
    scan.started = true;
  } else if (char === ",") {
    endCell(scan);
  } else if (char === "\n" || char === "\r") {
    const last = char === "\r" && text.charAt(index + 1) === "\n" ? index + 1 : index;
    endRecord(scan, records);
    scan.line += 1;
    scan.recordLine = scan.line;
    return last;
  } else {
    scan.cell += char;
    scan.started = true;
  }
  return index;
}

/**
 * Splits CSV text into rows. It handles quoted cells, commas and line breaks inside
 * quotes, doubled quotes, Windows line endings, a byte order mark and blank lines.
 * Nothing is read from disk. The text comes in and rows go out.
 */
export function parseCsv(input: string): CsvResult {
  const text = input.startsWith(BYTE_ORDER_MARK) ? input.slice(1) : input;
  const records: CsvRecord[] = [];
  const scan: Scan = { cells: [], cell: "", inQuotes: false, started: false, closed: false, recordLine: 1, line: 1 };

  for (let index = 0; index < text.length; index += 1) {
    const used = scan.inQuotes ? readQuoted(scan, text, index) : readPlain(scan, records, text, index);
    if (typeof used !== "number") return used;
    index = used;
  }
  if (scan.inQuotes) return failure(scan.recordLine, `Line ${scan.recordLine} opens a quote that is never closed. Add the closing quote.`);
  if (scan.started || scan.cells.length > 0 || scan.cell !== "") endRecord(scan, records);
  return { ok: true, records };
}
