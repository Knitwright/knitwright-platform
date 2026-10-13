import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  PROVENANCE_VALUES,
  createSpec,
  listTypes,
  pointsOfMeasureFor,
  type GarmentSpec,
  type Provenance,
} from "@/lib/garment";
import type { ChartSet } from "./chart-set";
import { MADE_UP_CHARTS, MADE_UP_CHART_SET, madeUpChart } from "./fixtures/made-up-charts";
import { deepFreeze } from "./fixtures/freeze";
import { MADE_UP_MEN_RUN, MADE_UP_RUNS } from "./fixtures/made-up-size-runs";
import { gradeChart } from "./grading";
import { resolveMeasurements, type ResolutionRow } from "./resolve";
import type { SizeChart } from "./schemas";

function specFor(typeId: string, wearer: "men" | "women" | "youth", fit?: string): GarmentSpec {
  const made = createSpec(typeId, wearer);
  if (!made.ok) throw new Error(made.reason);
  return fit === undefined ? made.spec : { ...made.spec, options: { ...made.spec.options, fit: { choiceId: fit, provenance: "user-edited" as const } } };
}

const withMeasurements = (spec: GarmentSpec, measurements: GarmentSpec["measurements"]): GarmentSpec => ({
  ...spec,
  measurements,
});

const rowFor = (rows: readonly ResolutionRow[], pointId: string): ResolutionRow => {
  const found = rows.find((row) => row.pointId === pointId);
  if (!found) throw new Error(`No row for ${pointId}.`);
  return found;
};

const NO_CHARTS: ChartSet = { runs: [], charts: [] };

function chartValues(chart: SizeChart, pointId: string): readonly number[] {
  const run = MADE_UP_RUNS.find((candidate) => candidate.id === chart.sizeRunId);
  if (!run) throw new Error("Missing run.");
  const graded = gradeChart(chart, run);
  if (!graded.ok) throw new Error("Bad chart.");
  return (graded.rows.find((row) => row.pointId === pointId)?.values ?? []).map((entry) => entry.value);
}

describe("resolveMeasurements with no chart", () => {
  it("says plainly that there is no chart, and never guesses or returns zero", () => {
    for (const type of listTypes()) {
      for (const wearer of type.wearers) {
        const spec = specFor(type.id, wearer);
        const result = resolveMeasurements(spec, "M", NO_CHARTS);
        expect(result.status).toBe("no-chart");
        expect(result.message).toContain("no Knitwright starter chart");
        expect(result.rows.map((row) => row.pointId)).toEqual(pointsOfMeasureFor(spec).map((point) => point.id));
        for (const row of result.rows) {
          expect(row.status).toBe("missing");
          expect(row).not.toHaveProperty("value");
          expect(row.status === "missing" && row.message.length).toBeGreaterThan(10);
        }
      }
    }
  });

  it("uses the shipped Knitwright starter charts when none are given, as suggestions", () => {
    const result = resolveMeasurements(specFor("crew-tee", "men"), "M");
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") expect(result.chartProvenance).toBe("suggested-chart");
  });

  it("still shows a value the user typed, in their own words, with no tolerance", () => {
    const spec = withMeasurements(specFor("crew-tee", "men"), [
      { pointId: "chest-width", value: 5000, provenance: "user-edited" },
    ]);
    const row = rowFor(resolveMeasurements(spec, "M", NO_CHARTS).rows, "chest-width");
    expect(row).toMatchObject({ status: "set", value: 5000, provenance: "user-edited", tolerance: null });
  });

  it("says so when the type is not known", () => {
    const spec = { ...specFor("crew-tee", "men"), typeId: "kilt" };
    const result = resolveMeasurements(spec, "M", MADE_UP_CHART_SET);
    expect(result.status).toBe("no-chart");
    expect(result.rows).toEqual([]);
  });

  it("says so when a chart exists only for a fit the design does not have", () => {
    const slimOnly: ChartSet = { runs: MADE_UP_RUNS, charts: [madeUpChart("crew-tee", "men", "slim")] };
    const result = resolveMeasurements(specFor("crew-tee", "men", "regular"), "T3", slimOnly);
    expect(result.status).toBe("no-chart");
    expect(result.message).toContain("slim");
    expect(result.message).toContain("regular");
  });

  it("says so when the chart cannot be graded", () => {
    const broken = { ...madeUpChart("crew-tee", "men"), baseSize: "ZZ" };
    const result = resolveMeasurements(specFor("crew-tee", "men"), "T3", { runs: MADE_UP_RUNS, charts: [broken] });
    expect(result.status).toBe("no-chart");
    expect(result.message).toContain("cannot be used");
  });
});

describe("resolveMeasurements with charts", () => {
  it("resolves every point of every tops type at every size in every chart that applies", () => {
    for (const chart of MADE_UP_CHARTS) {
      const run = MADE_UP_RUNS.find((candidate) => candidate.id === chart.sizeRunId);
      const spec = specFor(chart.garmentType, chart.wearer);
      for (const size of run?.sizes ?? []) {
        const result = resolveMeasurements(spec, size, MADE_UP_CHART_SET);
        expect(result.status).toBe("resolved");
        const expected = pointsOfMeasureFor(spec).map((point) => point.id);
        expect(result.rows.map((row) => row.pointId)).toEqual(expected);
        for (const row of result.rows) {
          expect(row.status).toBe("set");
          if (row.status === "set") {
            expect(row).toMatchObject({ provenance: "suggested-chart" });
            expect(row.value).toBeGreaterThan(0);
            expect(row.tolerance).toBe(100);
          }
        }
      }
    }
  });

  it("takes each value from the chart at the size asked for", () => {
    const chart = madeUpChart("crew-tee", "men");
    const spec = deepFreeze(specFor("crew-tee", "men"));
    const result = resolveMeasurements(spec, "T5", deepFreeze(structuredClone(MADE_UP_CHART_SET)));
    const values = chartValues(chart, "body-length");
    expect(rowFor(result.rows, "body-length")).toMatchObject({ value: values[4] });
    expect(result.status === "resolved" && result.baseSize).toBe("T3");
    expect(result.status === "resolved" && result.sizes).toEqual(MADE_UP_MEN_RUN.sizes);
  });

  it("gives a plain sentence and no rows for a size that is not in the run", () => {
    const result = resolveMeasurements(specFor("crew-tee", "men"), "XXL", MADE_UP_CHART_SET);
    expect(result.status).toBe("unknown-size");
    expect(result.message).toContain("T1, T2, T3, T4, T5");
    expect(result.rows).toEqual([]);
  });

  it("returns a point that applies but is missing from the chart as missing, never zero", () => {
    const partial: SizeChart = { ...madeUpChart("crew-tee", "men"), points: madeUpChart("crew-tee", "men").points.slice(0, 1) };
    const result = resolveMeasurements(specFor("crew-tee", "men"), "T3", { runs: MADE_UP_RUNS, charts: [partial] });
    const missing = result.rows.filter((row) => row.status === "missing");
    expect(missing.length).toBe(result.rows.length - 1);
    for (const row of missing) expect(row.status === "missing" && row.message).toContain("chart");
  });

  it("never labels a suggested value with any provenance except suggested from a chart", () => {
    const allowed: readonly Provenance[] = PROVENANCE_VALUES;
    for (const size of MADE_UP_MEN_RUN.sizes) {
      const result = resolveMeasurements(specFor("polo", "men"), size, MADE_UP_CHART_SET);
      for (const row of result.rows) {
        if (row.status === "set") {
          expect(allowed).toContain(row.provenance);
          expect(row.provenance).toBe("suggested-chart");
        }
      }
    }
    expect(JSON.stringify(PROVENANCE_VALUES)).not.toContain("verified");
  });
});

describe("resolveMeasurements and fit", () => {
  const bothCharts: ChartSet = {
    runs: MADE_UP_RUNS,
    charts: [madeUpChart("crew-tee", "men"), madeUpChart("crew-tee", "men", "slim")],
  };

  it("uses the chart for the design's fit when there is one", () => {
    const result = resolveMeasurements(specFor("crew-tee", "men", "slim"), "T3", bothCharts);
    expect(rowFor(result.rows, "chest-width")).toMatchObject({ value: 2500, provenance: "suggested-chart" });
    expect(result.status === "resolved" && result.chartFit).toBe("slim");
    expect(result.status === "resolved" && result.fitNote).toBeNull();
  });

  it("uses the chart with no fit for other fits and says so", () => {
    const result = resolveMeasurements(specFor("crew-tee", "men", "relaxed"), "T3", bothCharts);
    expect(rowFor(result.rows, "chest-width")).toMatchObject({ value: 2000 });
    expect(result.status === "resolved" && result.chartFit).toBeNull();
    expect(result.status === "resolved" && result.fitNote).toContain("relaxed");
  });

  it("uses the chart with no fit when the design has no fit option, without a fit note", () => {
    const spec = specFor("crew-tee", "men");
    const noFit = { ...spec, options: Object.fromEntries(Object.entries(spec.options).filter(([key]) => key !== "fit")) };
    const result = resolveMeasurements(noFit, "T3", bothCharts);
    expect(result.status).toBe("resolved");
    expect(result.status === "resolved" && result.fitNote).toBeNull();
  });

  it("does not use a fit chart when the design has no fit option", () => {
    const spec = specFor("crew-tee", "men");
    const noFit = { ...spec, options: Object.fromEntries(Object.entries(spec.options).filter(([key]) => key !== "fit")) };
    const result = resolveMeasurements(noFit, "T3", { runs: MADE_UP_RUNS, charts: [madeUpChart("crew-tee", "men", "slim")] });
    expect(result.status).toBe("no-chart");
  });
});

describe("resolveMeasurements with values the user set", () => {
  const chart = madeUpChart("crew-tee", "men");
  const chestValues = chartValues(chart, "chest-width");
  const userSpec = (provenance: Provenance, value = 3333): GarmentSpec =>
    withMeasurements(specFor("crew-tee", "men"), [{ pointId: "chest-width", value, provenance }]);

  it("lets the user's value and provenance win at the base size, keeping the chart tolerance", () => {
    const result = resolveMeasurements(deepFreeze(userSpec("brand-supplied")), "T3", MADE_UP_CHART_SET);
    expect(rowFor(result.rows, "chest-width")).toMatchObject({
      status: "set",
      value: 3333,
      provenance: "brand-supplied",
      tolerance: 100,
    });
  });

  it("grades the other sizes from the user's number with the chart's steps and calls them derived", () => {
    for (const [index, size] of MADE_UP_MEN_RUN.sizes.entries()) {
      if (size === "T3") continue;
      const row = rowFor(resolveMeasurements(userSpec("user-edited"), size, MADE_UP_CHART_SET).rows, "chest-width");
      const expected = 3333 + (chestValues[index] ?? 0) - (chestValues[2] ?? 0);
      expect(row).toMatchObject({ status: "set", value: expected, provenance: "derived", tolerance: 100 });
    }
  });

  it("leaves points the user did not touch as suggested from the chart", () => {
    const result = resolveMeasurements(userSpec("user-edited"), "T1", MADE_UP_CHART_SET);
    expect(rowFor(result.rows, "body-length")).toMatchObject({ provenance: "suggested-chart" });
  });

  it("keeps whatever provenance the spec carries at the base size, even from the assistant", () => {
    const result = resolveMeasurements(userSpec("ai-suggested"), "T3", MADE_UP_CHART_SET);
    expect(rowFor(result.rows, "chest-width")).toMatchObject({ provenance: "ai-suggested" });
  });

  it("returns missing when the user's number is too small to carry down to a smaller size", () => {
    const row = rowFor(resolveMeasurements(userSpec("user-edited", 100), "T1", MADE_UP_CHART_SET).rows, "chest-width");
    expect(row.status).toBe("missing");
    expect(row.status === "missing" && row.message).toContain("T1");
  });

  it("returns missing when the user's number is too large to carry up to a bigger size", () => {
    const row = rowFor(resolveMeasurements(userSpec("user-edited", 29_950), "T5", MADE_UP_CHART_SET).rows, "chest-width");
    expect(row.status).toBe("missing");
  });

  it("gives a user value with no chart entry no tolerance, and cannot grade it to other sizes", () => {
    const partial: SizeChart = { ...chart, points: chart.points.filter((point) => point.pointId === "body-length") };
    const set: ChartSet = { runs: MADE_UP_RUNS, charts: [partial] };
    const atBase = rowFor(resolveMeasurements(userSpec("user-edited"), "T3", set).rows, "chest-width");
    expect(atBase).toMatchObject({ status: "set", value: 3333, tolerance: null });
    const elsewhere = rowFor(resolveMeasurements(userSpec("user-edited"), "T4", set).rows, "chest-width");
    expect(elsewhere.status).toBe("missing");
    expect(elsewhere.status === "missing" && elsewhere.message).toContain("T3");
  });

  it("ignores a stored value for a point that does not apply to the design", () => {
    const spec = withMeasurements(specFor("crew-tee", "men"), [
      { pointId: "placket-length", value: 1000, provenance: "user-edited" },
    ]);
    const result = resolveMeasurements(spec, "T3", MADE_UP_CHART_SET);
    expect(result.rows.map((row) => row.pointId)).not.toContain("placket-length");
  });

  it("carries the user's number by exactly the chart's difference for any value and size", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 30_000 }), fc.integer({ min: 0, max: 4 }), (value, index) => {
        const size = MADE_UP_MEN_RUN.sizes[index] ?? "T1";
        const row = rowFor(resolveMeasurements(userSpec("user-edited", value), size, MADE_UP_CHART_SET).rows, "chest-width");
        if (row.status === "set") {
          expect(row.value).toBeGreaterThan(0);
          expect(row.value).toBe(value + (chestValues[index] ?? 0) - (chestValues[2] ?? 0));
          expect(row.provenance).toBe(index === 2 ? "user-edited" : "derived");
        } else {
          expect(row.message.length).toBeGreaterThan(10);
        }
      }),
    );
  });
});
