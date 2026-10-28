/**
 * Helpers for the Knitwright starter charts (owner decision, 2026-10-13). Every number in the
 * starter chart files is a garment measurement, taken on the finished garment laid flat, in
 * centimetres. Where each one comes from is written down in docs/sizing/starter-charts.md.
 * They are suggestions to check with a factory, never a factory's own numbers.
 */
import { getType, type Wearer } from "@/lib/garment";
import { pointsThatCanApply } from "../applicable-points";
import type { ChartPoint, ChartSource, Grade, SizeChart } from "../schemas";

/** The name the starter charts carry wherever their source is shown. */
export const STARTER_CHART_NAME = "Knitwright starter chart";

/** The day the starter charts were put together from published sources. */
const STARTER_CHART_SOURCE: ChartSource = { person: STARTER_CHART_NAME, date: "2026-10-13" };

const TENTHS_MM_PER_CM = 100;

const tenths = (cm: number): number => Math.round(cm * TENTHS_MM_PER_CM);

/** One grade step in centimetres used between every pair of sizes, or one step for each pair. */
export type CmGrade = number | readonly number[];

/** One row of a starter chart, in centimetres: the point, the base value, the grade and the tolerance. */
export type CmRow = readonly [pointId: string, baseCm: number, grade: CmGrade, toleranceCm: number];

const gradeOf = (grade: CmGrade): Grade =>
  typeof grade === "number" ? { kind: "even", step: tenths(grade) } : { kind: "steps", steps: grade.map(tenths) };

const pointOf = ([pointId, baseCm, grade, toleranceCm]: CmRow): ChartPoint => ({
  pointId,
  baseValue: tenths(baseCm),
  grade: gradeOf(grade),
  tolerance: tenths(toleranceCm),
});

/** Replaces some rows of a block, by point, and keeps the rest. Nothing is changed in place. */
export const withRows = (rows: readonly CmRow[], changes: readonly CmRow[]): readonly CmRow[] =>
  rows.map((row) => changes.find((change) => change[0] === row[0]) ?? row).concat(
    changes.filter((change) => !rows.some((row) => row[0] === change[0])),
  );

interface StarterRun {
  readonly id: string;
  readonly baseSize: string;
}

/**
 * The starter chart for one garment type and wearer. A block may hold points the type can
 * never have, such as a hood on a jacket, so only the points the type can have are kept.
 * A test checks that every point the type can have has a value.
 */
export function starterChart(typeId: string, wearer: Wearer, run: StarterRun, rows: readonly CmRow[]): SizeChart {
  const type = getType(typeId);
  const allowed = new Set(type ? pointsThatCanApply(type).map((point) => point.id) : []);
  return {
    wearer,
    garmentType: typeId,
    fit: null,
    sizeRunId: run.id,
    baseSize: run.baseSize,
    points: rows.filter(([pointId]) => allowed.has(pointId)).map(pointOf),
    source: STARTER_CHART_SOURCE,
    supplier: "platform",
  };
}
