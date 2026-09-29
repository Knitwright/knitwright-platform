import { MEASUREMENT_MAX_TENTHS_MM, WEARERS, formatCm, getType, listTypes, type Wearer } from "@/lib/garment";
import { parseCm, type CmFailure } from "./cm";
import { FIT_CHOICES, type Grade, type SizeChart } from "./schemas";
import { parseSourceNote } from "./source-note";

export const COLUMNS = [
  "wearer",
  "garment_type",
  "fit",
  "point_of_measure",
  "base_size",
  "base_value_cm",
  "grade_cm",
  "tolerance_cm",
  "source",
] as const;
export type Column = (typeof COLUMNS)[number];
export type Cells = Readonly<Record<Column, string>>;

/** One problem in an owner's file, in plain words. The message already names the line and column. */
export interface ParseProblem {
  readonly line: number;
  readonly column: string | null;
  readonly message: string;
}

export interface ParsedRow {
  readonly line: number;
  readonly wearer: Wearer;
  readonly garmentType: string;
  readonly fit: SizeChart["fit"];
  readonly pointId: string;
  readonly baseSize: string;
  readonly baseValue: number;
  readonly grade: Grade;
  readonly tolerance: number;
  readonly sourceText: string;
}

export type RowResult =
  | { readonly ok: true; readonly row: ParsedRow }
  | { readonly ok: false; readonly problems: readonly ParseProblem[] };

export const problemAt = (line: number, column: string | null, text: string): ParseProblem => ({
  line,
  column,
  message: column === null ? `Line ${line}: ${text}` : `Line ${line}, column ${column}: ${text}`,
});

const MAX_CM_TEXT = formatCm(MEASUREMENT_MAX_TENTHS_MM).replace(/\.0$/, "");

const CM_REASONS: Readonly<Record<CmFailure, (cell: string) => string>> = {
  empty: () => "Enter a number in centimetres.",
  formula: (cell) =>
    `"${cell}" starts with an equals, plus, minus or at sign, so it is read as text and not as a number. Type the number only.`,
  negative: (cell) => `"${cell}" is negative. A measurement cannot be below zero.`,
  "not-a-number": (cell) => `"${cell}" is not a number. Use digits and a dot, like 52.5.`,
  "too-precise": (cell) =>
    `"${cell}" is more exact than a tenth of a millimetre. Use at most two decimal places, like 52.55.`,
  "too-large": (cell) => `"${cell}" is too large. The most allowed is ${MAX_CM_TEXT} cm.`,
};

type NumberResult = { readonly ok: true; readonly value: number } | { readonly ok: false; readonly problem: ParseProblem };

function numberCell(line: number, column: Column, cell: string, minimum: number): NumberResult {
  const parsed = parseCm(cell);
  if (!parsed.ok) return { ok: false, problem: problemAt(line, column, CM_REASONS[parsed.reason](cell.trim())) };
  if (parsed.tenthsMm < minimum) {
    return { ok: false, problem: problemAt(line, column, `"${cell.trim()}" must be above zero.`) };
  }
  return { ok: true, value: parsed.tenthsMm };
}

function gradeCell(line: number, cell: string): { grade: Grade } | { problem: ParseProblem } {
  if (cell.trim() === "") {
    return { problem: problemAt(line, "grade_cm", "Enter how much the value changes from one size to the next. Use 0 if it stays the same.") };
  }
  const steps: number[] = [];
  for (const part of cell.split("/")) {
    const reading = parseCm(part);
    if (!reading.ok && reading.reason === "negative") {
      return { problem: problemAt(line, "grade_cm", "A grade cannot be negative. Use 0 if the value stays the same.") };
    }
    const step = numberCell(line, "grade_cm", part, 0);
    if (!step.ok) return { problem: step.problem };
    steps.push(step.value);
  }
  const [only] = steps;
  return only !== undefined && steps.length === 1
    ? { grade: { kind: "even", step: only } }
    : { grade: { kind: "steps", steps } };
}

const isWearer = (text: string): text is Wearer => (WEARERS as readonly string[]).includes(text);
const isFit = (text: string): text is (typeof FIT_CHOICES)[number] => (FIT_CHOICES as readonly string[]).includes(text);

/** Every point of measure any garment type has. Used to tell a misspelt point from one that does not fit a type. */
const KNOWN_POINTS: ReadonlySet<string> = new Set(
  listTypes().flatMap((type) => type.pointsOfMeasure.map((point) => point.id)),
);

function labelProblems(line: number, cells: Cells): readonly ParseProblem[] {
  const problems: ParseProblem[] = [];
  const wearer = cells.wearer.trim().toLowerCase();
  const type = cells.garment_type.trim().toLowerCase();
  const fit = cells.fit.trim().toLowerCase();
  const point = cells.point_of_measure.trim().toLowerCase();
  if (!isWearer(wearer)) {
    problems.push(problemAt(line, "wearer", `"${cells.wearer.trim()}" is not a wearer. Use ${WEARERS.join(", ")}.`));
  }
  if (!getType(type)) {
    problems.push(problemAt(line, "garment_type", `"${cells.garment_type.trim()}" is not a garment type we have. Check the spelling.`));
  }
  if (fit !== "" && !isFit(fit)) {
    problems.push(problemAt(line, "fit", `"${cells.fit.trim()}" is not a fit. Leave it empty, or use ${FIT_CHOICES.join(", ")}.`));
  }
  if (point === "") {
    problems.push(problemAt(line, "point_of_measure", "Enter the point of measure, such as chest-width."));
  } else if (!KNOWN_POINTS.has(point)) {
    problems.push(problemAt(line, "point_of_measure", `"${cells.point_of_measure.trim()}" is not a point of measure we know. Check the spelling.`));
  }
  if (cells.base_size.trim() === "") {
    problems.push(problemAt(line, "base_size", "Enter the base size, the size the numbers are given for."));
  }
  return problems;
}

/** Reads one filled in row. Every problem in the row is reported, not only the first. */
export function parseRow(line: number, cells: Cells): RowResult {
  const problems: ParseProblem[] = [...labelProblems(line, cells)];
  const base = numberCell(line, "base_value_cm", cells.base_value_cm, 1);
  const tolerance = numberCell(line, "tolerance_cm", cells.tolerance_cm, 1);
  const grade = gradeCell(line, cells.grade_cm);
  const source = parseSourceNote(cells.source);
  if (!base.ok) problems.push(base.problem);
  if (!tolerance.ok) problems.push(tolerance.problem);
  if ("problem" in grade) problems.push(grade.problem);
  if (!source.ok) problems.push(problemAt(line, "source", source.message));
  if (problems.length > 0 || !base.ok || !tolerance.ok || "problem" in grade) return { ok: false, problems };
  const fit = cells.fit.trim().toLowerCase();
  return {
    ok: true,
    row: {
      line,
      wearer: cells.wearer.trim().toLowerCase() as Wearer, // checked by labelProblems
      garmentType: cells.garment_type.trim().toLowerCase(),
      fit: fit === "" ? null : (fit as (typeof FIT_CHOICES)[number]), // checked by labelProblems
      pointId: cells.point_of_measure.trim().toLowerCase(),
      baseSize: cells.base_size.trim(),
      baseValue: base.value,
      grade: grade.grade,
      tolerance: tolerance.value,
      sourceText: cells.source.trim(),
    },
  };
}
