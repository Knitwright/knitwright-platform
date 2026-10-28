import { formatCm } from "@/lib/garment";
import type { ChartPoint, Grade } from "@/lib/sizing";
import type { CmFailure } from "@/lib/sizing/cm";
import { formatLength } from "@/lib/units/length";
import { readLength, UNIT_WORDS, type ChartUnit } from "./units";

/** Where one row's values are and what they are called, for plain messages. */
interface RowContext {
  readonly line: number;
  /** The point's name in the registry. */
  readonly label: string;
  readonly sizeColumns: readonly number[];
  readonly sizes: readonly string[];
  readonly toleranceColumn: number;
  readonly baseSize: string;
  /** The unit this row is written in. Values are stored in centimetres whatever it is. */
  readonly unit: ChartUnit;
}

type RowValues =
  | { readonly ok: true; readonly value: Omit<ChartPoint, "pointId"> }
  | { readonly ok: false; readonly problems: readonly string[] };

const HOW_TO_WRITE: Readonly<Record<ChartUnit, string>> = {
  cm: "Use digits and a dot, like 52.5.",
  in: "Use digits and a dot, like 20.5, or a fraction, like 20 1/2.",
};

const PRECISION: Readonly<Record<ChartUnit, string>> = {
  cm: "more exact than a tenth of a millimetre. Use at most two decimal places.",
  in: "more exact than a thousandth of an inch. Use at most three decimal places.",
};

const REASONS: Readonly<Record<Exclude<CmFailure, "empty">, (cell: string, unit: ChartUnit) => string>> = {
  formula: (cell) => `"${cell}" starts with =, +, - or @, so it is read as text and never worked out. Type the number only.`,
  negative: (cell) => `"${cell}" is negative. A measurement cannot be below zero.`,
  "not-a-number": (cell, unit) => `"${cell}" is not a number of ${UNIT_WORDS[unit]}. ${HOW_TO_WRITE[unit]}`,
  "too-precise": (cell, unit) => `"${cell}" is ${PRECISION[unit]}`,
  "too-large": (cell) => `"${cell}" is too large for a garment measurement.`,
};

type Reading = { readonly ok: true; readonly tenths: number } | { readonly ok: false; readonly reason: string };

function readCell(cell: string, unit: ChartUnit): Reading {
  const parsed = readLength(cell, unit);
  if (parsed.ok) return parsed.tenthsMm >= 1 ? { ok: true, tenths: parsed.tenthsMm } : { ok: false, reason: "It must be above zero." };
  if (parsed.reason === "empty") return { ok: false, reason: "It is empty." };
  return { ok: false, reason: REASONS[parsed.reason](cell.trim(), unit) };
}

/** A stored length, written in the unit the person's file uses. */
const shown = (tenths: number, unit: ChartUnit): string =>
  unit === "in" ? formatLength(tenths / 100, "in") : `${formatCm(tenths)} cm`;

function gradeOf(values: readonly number[], context: RowContext): { grade: Grade } | { problem: string } {
  const steps: number[] = [];
  for (let index = 1; index < values.length; index += 1) {
    const before = values[index - 1] ?? 0;
    const after = values[index] ?? 0;
    if (after < before) {
      const [small, large] = [context.sizes[index - 1], context.sizes[index]];
      return {
        problem: `Line ${context.line}: ${context.label} is ${shown(before, context.unit)} at size ${small} but ${shown(after, context.unit)} at size ${large}. A chart must not get smaller as sizes go up. Check the values and the order of the size columns.`,
      };
    }
    steps.push(after - before);
  }
  const [only] = steps;
  return only !== undefined && steps.length === 1 ? { grade: { kind: "even", step: only } } : { grade: { kind: "steps", steps } };
}

/**
 * Reads one row: a value for every size, smallest first, and a tolerance, all in the row's
 * unit. Cells are text. Centimetres are read exactly, so 52.5 is 5250 tenths of a millimetre;
 * inches are turned into centimetres to the nearest tenth of a millimetre. Every problem in
 * the row is reported, each naming the line and the size.
 */
export function readRowValues(cells: readonly string[], context: RowContext): RowValues {
  const problems: string[] = [];
  const values: number[] = [];
  context.sizeColumns.forEach((column, index) => {
    const reading = readCell(cells[column] ?? "", context.unit);
    if (reading.ok) values.push(reading.tenths);
    else problems.push(`Line ${context.line}: ${context.label} for size ${context.sizes[index]} cannot be read. ${reading.reason}`);
  });
  const tolerance = readCell(cells[context.toleranceColumn] ?? "", context.unit);
  if (!tolerance.ok) {
    problems.push(`Line ${context.line}: ${context.label} needs a tolerance above zero, in ${UNIT_WORDS[context.unit]}. ${tolerance.reason}`);
  }
  if (problems.length > 0 || !tolerance.ok) return { ok: false, problems };
  const graded = gradeOf(values, context);
  if ("problem" in graded) return { ok: false, problems: [graded.problem] };
  const baseValue = values[context.sizes.indexOf(context.baseSize.trim())] ?? 0;
  return { ok: true, value: { baseValue, grade: graded.grade, tolerance: tolerance.tenths } };
}
