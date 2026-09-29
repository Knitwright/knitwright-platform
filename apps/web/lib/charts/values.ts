import { formatCm } from "@/lib/garment";
import type { ChartPoint, Grade } from "@/lib/sizing";
import { parseCm, type CmFailure } from "@/lib/sizing/cm";

/** Where one row's values are and what they are called, for plain messages. */
export interface RowContext {
  readonly line: number;
  /** The point's name in the registry. */
  readonly label: string;
  readonly sizeColumns: readonly number[];
  readonly sizes: readonly string[];
  readonly toleranceColumn: number;
  readonly baseSize: string;
}

export type RowValues =
  | { readonly ok: true; readonly value: Omit<ChartPoint, "pointId"> }
  | { readonly ok: false; readonly problems: readonly string[] };

const REASONS: Readonly<Record<Exclude<CmFailure, "empty">, (cell: string) => string>> = {
  formula: (cell) => `"${cell}" starts with =, +, - or @, so it is read as text and never worked out. Type the number only.`,
  negative: (cell) => `"${cell}" is negative. A measurement cannot be below zero.`,
  "not-a-number": (cell) => `"${cell}" is not a number of centimetres. Use digits and a dot, like 52.5.`,
  "too-precise": (cell) => `"${cell}" is more exact than a tenth of a millimetre. Use at most two decimal places.`,
  "too-large": (cell) => `"${cell}" is too large for a garment measurement.`,
};

type Reading = { readonly ok: true; readonly tenths: number } | { readonly ok: false; readonly reason: string };

function readCell(cell: string): Reading {
  const parsed = parseCm(cell);
  if (parsed.ok) return parsed.tenthsMm >= 1 ? { ok: true, tenths: parsed.tenthsMm } : { ok: false, reason: "It must be above zero." };
  if (parsed.reason === "empty") return { ok: false, reason: "It is empty." };
  return { ok: false, reason: REASONS[parsed.reason](cell.trim()) };
}

function gradeOf(values: readonly number[], context: RowContext): { grade: Grade } | { problem: string } {
  const steps: number[] = [];
  for (let index = 1; index < values.length; index += 1) {
    const before = values[index - 1] ?? 0;
    const after = values[index] ?? 0;
    if (after < before) {
      const [small, large] = [context.sizes[index - 1], context.sizes[index]];
      return {
        problem: `Line ${context.line}: ${context.label} is ${formatCm(before)} cm at size ${small} but ${formatCm(after)} cm at size ${large}. A chart must not get smaller as sizes go up. Check the values and the order of the size columns.`,
      };
    }
    steps.push(after - before);
  }
  const [only] = steps;
  return only !== undefined && steps.length === 1 ? { grade: { kind: "even", step: only } } : { grade: { kind: "steps", steps } };
}

/**
 * Reads one row: a value for every size, smallest first, and a tolerance. Cells are text
 * and are read as plain centimetres, so 52.5 is exactly 5250 tenths of a millimetre. Every
 * problem in the row is reported, each naming the line and the size.
 */
export function readRowValues(cells: readonly string[], context: RowContext): RowValues {
  const problems: string[] = [];
  const values: number[] = [];
  context.sizeColumns.forEach((column, index) => {
    const reading = readCell(cells[column] ?? "");
    if (reading.ok) values.push(reading.tenths);
    else problems.push(`Line ${context.line}: ${context.label} for size ${context.sizes[index]} cannot be read. ${reading.reason}`);
  });
  const tolerance = readCell(cells[context.toleranceColumn] ?? "");
  if (!tolerance.ok) {
    problems.push(`Line ${context.line}: ${context.label} needs a tolerance above zero, in centimetres. ${tolerance.reason}`);
  }
  if (problems.length > 0 || !tolerance.ok) return { ok: false, problems };
  const graded = gradeOf(values, context);
  if ("problem" in graded) return { ok: false, problems: [graded.problem] };
  const baseValue = values[context.sizes.indexOf(context.baseSize.trim())] ?? 0;
  return { ok: true, value: { baseValue, grade: graded.grade, tolerance: tolerance.tenths } };
}
