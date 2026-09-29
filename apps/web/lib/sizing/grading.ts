import { MEASUREMENT_MAX_TENTHS_MM, formatCm } from "@/lib/garment";
import { must } from "./invariant";
import type { Grade, SizeChart, SizeRun } from "./schemas";

/** A reason a chart cannot be used. It says where to look, in the owner's column names. */
export interface ChartProblem {
  readonly pointId: string | null;
  readonly column: string | null;
  readonly message: string;
}

export interface GradedValue {
  readonly size: string;
  /** Whole tenths of a millimetre. */
  readonly value: number;
}

export interface GradedRow {
  readonly pointId: string;
  readonly tolerance: number;
  /** One value for every size in the run, smallest first. */
  readonly values: readonly GradedValue[];
}

export type GradeResult =
  | { readonly ok: true; readonly rows: readonly GradedRow[] }
  | { readonly ok: false; readonly problems: readonly ChartProblem[] };

/** The change for each pair of sizes, or null when a list of steps has the wrong length. */
export function stepsFor(grade: Grade, pairCount: number): readonly number[] | null {
  if (grade.kind === "even") return Array.from({ length: pairCount }, () => grade.step);
  return grade.steps.length === pairCount ? grade.steps : null;
}

/**
 * The value at every size. Sizes above the base add the steps between them and the
 * base. Sizes below take those steps away. Whole numbers all the way, so nothing drifts.
 */
export function gradeValues(baseValue: number, steps: readonly number[], baseIndex: number): readonly number[] {
  if (!Number.isInteger(baseIndex) || baseIndex < 0 || baseIndex > steps.length) {
    throw new Error("Sizing broke a rule it depends on: the base index was outside the size run.");
  }
  const values = new Array<number>(steps.length + 1).fill(baseValue);
  for (let index = baseIndex + 1; index <= steps.length; index += 1) {
    values[index] = must(values[index - 1], "the value before a step") + must(steps[index - 1], "a grade step");
  }
  for (let index = baseIndex - 1; index >= 0; index -= 1) {
    values[index] = must(values[index + 1], "the value after a step") - must(steps[index], "a grade step");
  }
  return values;
}

const problem = (pointId: string | null, column: string, message: string): ChartProblem => ({
  pointId,
  column,
  message,
});

function outOfRange(pointId: string, run: SizeRun, values: readonly number[]): ChartProblem | null {
  const badIndex = values.findIndex((value) => value < 1 || value > MEASUREMENT_MAX_TENTHS_MM);
  if (badIndex < 0) return null;
  const size = must(run.sizes[badIndex], "a size label");
  const value = must(values[badIndex], "a graded value");
  const detail =
    value < 1
      ? `would be ${formatCm(value)} cm`
      : `would be ${formatCm(value)} cm, over the limit of ${formatCm(MEASUREMENT_MAX_TENTHS_MM)} cm`;
  return problem(
    pointId,
    "grade_cm",
    `${pointId} ${detail} at size ${size}. A measurement must be above zero and within the limit. Check the base value and the grade.`,
  );
}

/**
 * Works out every point of measure at every size. A chart that has a base size outside
 * the run, the wrong number of grade steps, or a value at or below zero is refused.
 */
export function gradeChart(chart: SizeChart, run: SizeRun): GradeResult {
  const baseIndex = run.sizes.indexOf(chart.baseSize);
  if (baseIndex < 0) {
    return {
      ok: false,
      problems: [
        problem(
          null,
          "base_size",
          `The base size "${chart.baseSize}" is not in the ${chart.wearer} size run, which is ${run.sizes.join(", ")}. Use one of those sizes.`,
        ),
      ],
    };
  }
  const pairCount = run.sizes.length - 1;
  const rows: GradedRow[] = [];
  const problems: ChartProblem[] = [];
  for (const point of chart.points) {
    const steps = stepsFor(point.grade, pairCount);
    if (steps === null) {
      const given = point.grade.kind === "steps" ? point.grade.steps.length : 1;
      problems.push(
        problem(
          point.pointId,
          "grade_cm",
          `${point.pointId} has ${given} grade steps, but ${run.sizes.length} sizes need ${pairCount}, one for each pair of sizes. Give one step for all pairs, or ${pairCount} steps separated by /.`,
        ),
      );
      continue;
    }
    const values = gradeValues(point.baseValue, steps, baseIndex);
    const bad = outOfRange(point.pointId, run, values);
    if (bad) {
      problems.push(bad);
      continue;
    }
    rows.push({
      pointId: point.pointId,
      tolerance: point.tolerance,
      values: values.map((value, index) => ({ size: must(run.sizes[index], "a size label"), value })),
    });
  }
  return problems.length > 0 ? { ok: false, problems } : { ok: true, rows };
}
