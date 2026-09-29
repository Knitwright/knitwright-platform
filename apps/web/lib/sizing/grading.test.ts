import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { MADE_UP_CHARTS } from "./fixtures/made-up-charts";
import { MADE_UP_RUNS } from "./fixtures/made-up-size-runs";
import { deepFreeze } from "./fixtures/freeze";
import { gradeChart, gradeValues, stepsFor } from "./grading";
import type { Grade, SizeChart, SizeRun } from "./schemas";

describe("stepsFor", () => {
  it("repeats one even step for every pair of sizes", () => {
    expect(stepsFor({ kind: "even", step: 250 }, 3)).toEqual([250, 250, 250]);
  });

  it("returns listed steps as they are, and null when the count is wrong", () => {
    expect(stepsFor({ kind: "steps", steps: [100, 200, 300] }, 3)).toEqual([100, 200, 300]);
    expect(stepsFor({ kind: "steps", steps: [100, 200] }, 3)).toBeNull();
  });
});

describe("gradeValues", () => {
  it("grades up above the base size and down below it", () => {
    expect(gradeValues(5000, [100, 200, 300, 400], 2)).toEqual([4700, 4800, 5000, 5300, 5700]);
  });

  it("works when the base is the smallest or the largest size", () => {
    expect(gradeValues(1000, [10, 20], 0)).toEqual([1000, 1010, 1030]);
    expect(gradeValues(1000, [10, 20], 2)).toEqual([970, 980, 1000]);
  });

  it("always equals the base value at the base size and moves by exactly each step", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 0, max: 11 }),
        fc.integer({ min: 100_000, max: 200_000 }),
        fc.infiniteStream(fc.integer({ min: -900, max: 900 })),
        (pairs, baseRaw, base, stream) => {
          const steps = [...stream.take(pairs)];
          const baseIndex = baseRaw % (pairs + 1);
          const values = deepFreeze(gradeValues(base, deepFreeze(steps), baseIndex));
          expect(values).toHaveLength(pairs + 1);
          expect(values[baseIndex]).toBe(base);
          steps.forEach((step, pair) => {
            expect((values[pair + 1] ?? 0) - (values[pair] ?? 0)).toBe(step);
          });
        },
      ),
    );
  });

  it("never makes a larger size smaller when every step is zero or more", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 900 }), { minLength: 1, maxLength: 12 }),
        fc.integer({ min: 0, max: 11 }),
        (steps, baseRaw) => {
          const values = gradeValues(50_000, steps, baseRaw % (steps.length + 1));
          values.slice(1).forEach((value, index) => {
            expect(value).toBeGreaterThanOrEqual(values[index] ?? Number.POSITIVE_INFINITY);
          });
        },
      ),
    );
  });

  it("never makes a larger size larger when every step is zero or less", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -900, max: 0 }), { minLength: 1, maxLength: 12 }), (steps) => {
        const values = gradeValues(50_000, steps, 0);
        values.slice(1).forEach((value, index) => {
          expect(value).toBeLessThanOrEqual(values[index] ?? Number.NEGATIVE_INFINITY);
        });
      }),
    );
  });
});

const runFor = (chart: SizeChart): SizeRun => {
  const run = MADE_UP_RUNS.find((candidate) => candidate.id === chart.sizeRunId);
  if (!run) throw new Error("Missing run.");
  return run;
};

describe("gradeChart", () => {
  it("gives every point of measure a value at every size in the run", () => {
    for (const chart of MADE_UP_CHARTS) {
      const run = runFor(chart);
      const result = gradeChart(deepFreeze(structuredClone(chart)), run);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.rows.map((row) => row.pointId)).toEqual(chart.points.map((point) => point.pointId));
      for (const row of result.rows) {
        expect(row.values.map((entry) => entry.size)).toEqual(run.sizes);
        const atBase = row.values.find((entry) => entry.size === chart.baseSize);
        const point = chart.points.find((candidate) => candidate.pointId === row.pointId);
        expect(atBase?.value).toBe(point?.baseValue);
        expect(row.values.every((entry) => entry.value > 0)).toBe(true);
        expect(row.tolerance).toBe(point?.tolerance);
      }
    }
  });

  const tiny = (baseValue: number, step: number): SizeChart => ({
    ...(MADE_UP_CHARTS[0] as SizeChart),
    baseSize: "T3",
    points: [{ pointId: "chest-width", baseValue, grade: { kind: "even", step }, tolerance: 100 }],
  });
  const menRun = MADE_UP_RUNS[0] as SizeRun;

  it("refuses a chart that would give zero or less, naming the size and the point", () => {
    const result = gradeChart(tiny(200, 100), menRun);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems[0]).toMatchObject({ pointId: "chest-width", column: "grade_cm" });
    expect(result.problems[0]?.message).toContain("chest-width");
    expect(result.problems[0]?.message).toContain("T1");
    expect(result.problems[0]?.message).toContain("0.0 cm");
  });

  it("refuses a chart that would go over the largest length allowed", () => {
    const result = gradeChart(tiny(29_900, 500), menRun);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems[0]?.message).toContain("T4");
    expect(result.problems[0]?.message).toContain("300.0 cm");
  });

  it("refuses a chart whose base size is not in the run or whose steps are the wrong count", () => {
    expect(gradeChart({ ...tiny(5000, 100), baseSize: "ZZ" }, menRun).ok).toBe(false);
    const wrongCount: Grade = { kind: "steps", steps: [100, 100] };
    const chart = tiny(5000, 100);
    const result = gradeChart({ ...chart, points: [{ ...(chart.points[0] as (typeof chart.points)[number]), grade: wrongCount }] }, menRun);
    expect(result.ok).toBe(false);
  });

  it("never returns a zero or negative value for any chart it accepts", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30_000 }),
        fc.integer({ min: -3000, max: 3000 }),
        fc.integer({ min: 0, max: 4 }),
        (base, step, baseIndex) => {
          const chart = { ...tiny(base, step), baseSize: menRun.sizes[baseIndex] ?? "T1" };
          const result = gradeChart(chart, menRun);
          if (result.ok) {
            for (const entry of result.rows.flatMap((row) => row.values)) expect(entry.value).toBeGreaterThan(0);
          } else {
            expect(result.problems.length).toBeGreaterThan(0);
          }
        },
      ),
    );
  });
});
