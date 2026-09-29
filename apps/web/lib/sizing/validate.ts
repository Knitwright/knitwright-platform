import { getType } from "@/lib/garment";
import { pointsThatCanApply } from "./applicable-points";
import type { ChartSet } from "./chart-set";
import { gradeChart, type ChartProblem } from "./grading";
import { sizeChartSchema, sizeRunSchema, type SizeChart, type SizeRun } from "./schemas";

export type ChartSetResult =
  | { readonly ok: true; readonly set: ChartSet }
  | { readonly ok: false; readonly problems: readonly string[] };

/** One chart per wearer, garment type and fit. A chart with no fit is written "any". */
export const chartKey = (chart: Pick<SizeChart, "wearer" | "garmentType" | "fit">): string =>
  `${chart.wearer}/${chart.garmentType}/${chart.fit ?? "any"}`;

const issue = (pointId: string | null, column: string, message: string): ChartProblem => ({
  pointId,
  column,
  message,
});

function typeProblems(chart: SizeChart): readonly ChartProblem[] {
  const type = getType(chart.garmentType);
  if (!type) {
    return [issue(null, "garment_type", `There is no garment type called ${chart.garmentType}.`)];
  }
  const problems: ChartProblem[] = [];
  if (!type.wearers.includes(chart.wearer)) {
    problems.push(
      issue(null, "wearer", `${type.label} is not offered for ${chart.wearer}, so it cannot have a chart for them.`),
    );
  }
  const allowed = new Set(pointsThatCanApply(type).map((point) => point.id));
  for (const point of chart.points) {
    if (!allowed.has(point.pointId)) {
      problems.push(
        issue(
          point.pointId,
          "point_of_measure",
          `${point.pointId} is not a point of measure for ${chart.garmentType}. It may be misspelled, or this garment has no such part.`,
        ),
      );
    }
  }
  return problems;
}

function runProblems(chart: SizeChart, run: SizeRun): readonly ChartProblem[] {
  if (run.id !== chart.sizeRunId) {
    return [issue(null, "base_size", `The chart uses the size run ${chart.sizeRunId}, not ${run.id}.`)];
  }
  if (run.wearer !== chart.wearer) {
    return [
      issue(null, "wearer", `The size run ${run.id} is for ${run.wearer}, but the chart is for ${chart.wearer}.`),
    ];
  }
  return [];
}

/**
 * Every reason a chart cannot be used with a size run. An empty list means it is fine.
 * A chart that would grade to zero or below at any size is refused, naming the size.
 */
export function checkChart(chart: SizeChart, run: SizeRun): readonly ChartProblem[] {
  const early = [...runProblems(chart, run), ...typeProblems(chart)];
  if (early.length > 0) return early;
  const graded = gradeChart(chart, run);
  return graded.ok ? [] : graded.problems;
}

function schemaProblems(runs: readonly SizeRun[], charts: readonly SizeChart[]): readonly string[] {
  const found: string[] = [];
  runs.forEach((run, index) => {
    const parsed = sizeRunSchema.safeParse(run);
    if (!parsed.success) found.push(`Size run ${index + 1}: ${parsed.error.issues[0]?.message ?? "not valid."}`);
  });
  charts.forEach((chart, index) => {
    const parsed = sizeChartSchema.safeParse(chart);
    if (!parsed.success) found.push(`Chart ${index + 1}: ${parsed.error.issues[0]?.message ?? "not valid."}`);
  });
  return found;
}

function duplicateProblems(runs: readonly SizeRun[], charts: readonly SizeChart[]): readonly string[] {
  const found: string[] = [];
  const runIds = new Set<string>();
  for (const run of runs) {
    if (runIds.has(run.id)) found.push(`The size run ${run.id} appears more than once.`);
    runIds.add(run.id);
  }
  const keys = new Set<string>();
  for (const chart of charts) {
    const key = chartKey(chart);
    if (keys.has(key)) found.push(`There are two charts for ${key}. Keep one.`);
    keys.add(key);
  }
  return found;
}

/** Checks a set of size runs and charts as a whole. Nothing is thrown. */
export function buildChartSet(runs: readonly SizeRun[], charts: readonly SizeChart[]): ChartSetResult {
  const problems = [...schemaProblems(runs, charts), ...duplicateProblems(runs, charts)];
  if (problems.length === 0) {
    for (const chart of charts) {
      const run = runs.find((candidate) => candidate.id === chart.sizeRunId);
      if (!run) {
        problems.push(`The chart ${chartKey(chart)} uses the size run ${chart.sizeRunId}, which is missing.`);
        continue;
      }
      problems.push(...checkChart(chart, run).map((found) => `${chartKey(chart)}: ${found.message}`));
    }
  }
  return problems.length > 0 ? { ok: false, problems } : { ok: true, set: { runs, charts } };
}
