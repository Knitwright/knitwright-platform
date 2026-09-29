import { parseCsv, type CsvRecord } from "./csv";
import { checkChart } from "./validate";
import { COLUMNS, parseRow, problemAt, type Cells, type Column, type ParsedRow, type ParseProblem } from "./parse-row";
import type { SizeChart, SizeRun } from "./schemas";
import { parseSourceNote } from "./source-note";

export type { ParseProblem } from "./parse-row";

export type ParseResult =
  | { readonly ok: true; readonly charts: readonly SizeChart[]; readonly skippedLines: readonly number[] }
  | { readonly ok: false; readonly problems: readonly ParseProblem[] };

/** A row with nothing filled in after the point of measure is a blank line of the template. */
const FILLED_COLUMNS: readonly Column[] = ["base_size", "base_value_cm", "grade_cm", "tolerance_cm", "source"];

const byLine = (a: ParseProblem, b: ParseProblem): number => a.line - b.line;

function readHeader(record: CsvRecord): { index: Map<Column, number>; problems: ParseProblem[] } {
  const names = record.cells.map((cell) => cell.trim().toLowerCase());
  const index = new Map<Column, number>();
  const problems: ParseProblem[] = [];
  for (const column of COLUMNS) {
    const position = names.indexOf(column);
    if (position < 0) {
      problems.push(problemAt(record.line, column, "This column is missing from the first line. Add it, using the template's column names."));
    } else {
      index.set(column, position);
    }
  }
  return { index, problems };
}

function cellsOf(record: CsvRecord, index: ReadonlyMap<Column, number>): Cells {
  const at = (column: Column): string => record.cells[index.get(column) ?? -1] ?? "";
  return Object.fromEntries(COLUMNS.map((column) => [column, at(column)])) as Record<Column, string>; // COLUMNS lists every key
}

function readRows(
  records: readonly CsvRecord[],
  index: ReadonlyMap<Column, number>,
  headerLength: number,
): { rows: ParsedRow[]; skipped: number[]; problems: ParseProblem[] } {
  const rows: ParsedRow[] = [];
  const skipped: number[] = [];
  const problems: ParseProblem[] = [];
  for (const record of records) {
    if (record.cells.length > headerLength) {
      problems.push(problemAt(record.line, null, "This line has more cells than the first line has columns. Check for a stray comma."));
      continue;
    }
    const cells = cellsOf(record, index);
    if (FILLED_COLUMNS.every((column) => cells[column].trim() === "")) {
      skipped.push(record.line);
      continue;
    }
    const result = parseRow(record.line, cells);
    if (result.ok) rows.push(result.row);
    else problems.push(...result.problems);
  }
  return { rows, skipped, problems };
}

function groupRows(rows: readonly ParsedRow[]): readonly (readonly ParsedRow[])[] {
  const groups = new Map<string, ParsedRow[]>();
  for (const row of rows) {
    const key = `${row.wearer}/${row.garmentType}/${row.fit ?? "any"}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()];
}

function consistencyProblems(group: readonly ParsedRow[]): { unique: ParsedRow[]; problems: ParseProblem[] } {
  const [first] = group;
  const unique: ParsedRow[] = [];
  const problems: ParseProblem[] = [];
  const seen = new Map<string, number>();
  for (const row of group) {
    if (first && row.baseSize !== first.baseSize) {
      problems.push(problemAt(row.line, "base_size", `The base size is ${row.baseSize}, but line ${first.line} says ${first.baseSize}. A chart has one base size.`));
    }
    if (first && row.sourceText !== first.sourceText) {
      problems.push(problemAt(row.line, "source", `The source differs from line ${first.line}. A chart has one source.`));
    }
    const earlier = seen.get(row.pointId);
    if (earlier !== undefined) {
      problems.push(problemAt(row.line, "point_of_measure", `${row.pointId} is already given for this chart on line ${earlier}. Keep one.`));
      continue;
    }
    seen.set(row.pointId, row.line);
    unique.push(row);
  }
  return { unique, problems };
}

function buildChart(group: readonly ParsedRow[], runs: readonly SizeRun[]): { chart?: SizeChart; problems: ParseProblem[] } {
  const { unique, problems } = consistencyProblems(group);
  const [first] = unique;
  const run = first ? runs.find((candidate) => candidate.wearer === first.wearer) : undefined;
  if (!first) return { problems };
  if (!run) {
    problems.push(problemAt(first.line, "wearer", `There is no size run for ${first.wearer}. Send the sizes for ${first.wearer}, smallest first.`));
    return { problems };
  }
  const source = parseSourceNote(first.sourceText);
  if (!source.ok || problems.length > 0) return { problems };
  const chart: SizeChart = {
    wearer: first.wearer,
    garmentType: first.garmentType,
    fit: first.fit,
    sizeRunId: run.id,
    baseSize: first.baseSize,
    points: unique.map((row) => ({ pointId: row.pointId, baseValue: row.baseValue, grade: row.grade, tolerance: row.tolerance })),
    source: source.source,
  };
  for (const found of checkChart(chart, run)) {
    const line = unique.find((row) => row.pointId === found.pointId)?.line ?? first.line;
    problems.push(problemAt(line, found.column, found.message));
  }
  return problems.length > 0 ? { problems } : { chart, problems };
}

/**
 * Reads the text of a CSV in the size chart template's format and gives charts, or a
 * list of problems in plain words that name the line and the column. Nothing is read
 * from disk. Rows that are not filled in yet are skipped and their lines are reported.
 */
export function parseChartsCsv(text: string, runs: readonly SizeRun[]): ParseResult {
  const scanned = parseCsv(text);
  if (!scanned.ok) return { ok: false, problems: [{ line: scanned.line, column: null, message: scanned.message }] };
  const [headerRecord, ...records] = scanned.records;
  if (!headerRecord) {
    return { ok: false, problems: [problemAt(1, null, "The file is empty. Use the size chart template and fill it in.")] };
  }
  const header = readHeader(headerRecord);
  if (header.problems.length > 0) return { ok: false, problems: header.problems };
  const read = readRows(records, header.index, headerRecord.cells.length);
  if (read.problems.length > 0) return { ok: false, problems: [...read.problems].sort(byLine) };
  const charts: SizeChart[] = [];
  const problems: ParseProblem[] = [];
  for (const group of groupRows(read.rows)) {
    const built = buildChart(group, runs);
    problems.push(...built.problems);
    if (built.chart) charts.push(built.chart);
  }
  if (problems.length > 0) return { ok: false, problems: problems.sort(byLine) };
  return { ok: true, charts, skippedLines: read.skipped };
}
