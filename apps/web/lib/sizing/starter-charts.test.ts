import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyAction, getType, type GarmentSpec, type Wearer } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { LAUNCH_GARMENTS } from "@/lib/config/launch-garments";
import { pointsThatCanApply } from "./applicable-points";
import { DEFAULT_CHART_SET, STARTER_CHART_NAME } from "./charts";
import { gradeChart } from "./grading";
import { withBrandCharts, type BrandChart } from "./brand-charts";
import { chartProvenanceOf, resolveMeasurements } from "./resolve";
import { resolveAllSizes } from "./resolve-all";
import type { SizeChart } from "./schemas";
import { sizingFromChart } from "./sizing-from-chart";
import { buildChartSet } from "./validate";

const charts = DEFAULT_CHART_SET.charts;

const chartFor = (typeId: string, wearer: Wearer): SizeChart => {
  const found = charts.find((chart) => chart.garmentType === typeId && chart.wearer === wearer);
  if (!found) throw new Error(`No starter chart for ${typeId} for ${wearer}.`);
  return found;
};

/** The value of a point at a size, in centimetres. */
const cmAt = (chart: SizeChart, pointId: string, size: string): number => {
  const run = DEFAULT_CHART_SET.runs.find((candidate) => candidate.id === chart.sizeRunId);
  if (!run) throw new Error("missing run");
  const graded = gradeChart(chart, run);
  if (!graded.ok) throw new Error(graded.problems[0]?.message);
  const value = graded.rows.find((row) => row.pointId === pointId)?.values.find((entry) => entry.size === size)?.value;
  if (value === undefined) throw new Error(`${pointId} has no value at ${size}`);
  return value / 100;
};

const base = (chart: SizeChart, pointId: string): number => cmAt(chart, pointId, chart.baseSize);

const pairs = LAUNCH_GARMENTS.flatMap((typeId) => (getType(typeId)?.wearers ?? []).map((wearer) => [typeId, wearer] as const));

describe("the Knitwright starter charts", () => {
  it("cover every garment offered at launch, for every wearer it is made for", () => {
    expect(pairs.length).toBe(39);
    for (const [typeId, wearer] of pairs) expect(() => chartFor(typeId, wearer)).not.toThrow();
  });

  it("pass the full check as a set", () => {
    const built = buildChartSet(DEFAULT_CHART_SET.runs, DEFAULT_CHART_SET.charts);
    expect(built.ok ? [] : built.problems).toEqual([]);
  });

  it("give a value for every point of measure the garment can have, and no other", () => {
    for (const [typeId, wearer] of pairs) {
      const type = getType(typeId);
      if (!type) throw new Error(typeId);
      const wanted = pointsThatCanApply(type).map((point) => point.id).sort();
      expect(chartFor(typeId, wearer).points.map((point) => point.pointId).sort(), `${typeId} for ${wearer}`).toEqual(wanted);
    }
  });

  it("are platform suggestions named as the Knitwright starter chart, used for every fit", () => {
    expect(STARTER_CHART_NAME).toBe("Knitwright starter chart");
    for (const chart of charts) {
      expect(chart.supplier).toBe("platform");
      expect(chart.source.person).toBe(STARTER_CHART_NAME);
      expect(chart.fit).toBeNull();
      expect(chartProvenanceOf(chart)).toBe("suggested-chart");
      for (const point of chart.points) expect(point.tolerance).toBeGreaterThan(0);
    }
  });

  it("use one size run for each wearer, with the middle size as the base", () => {
    expect(DEFAULT_CHART_SET.runs.map((run) => [run.wearer, run.sizes.join(" ")])).toEqual([
      ["men", "XS S M L XL 2XL 3XL"],
      ["women", "XS S M L XL 2XL"],
      ["youth", "YXS YS YM YL YXL"],
    ]);
    for (const chart of charts) expect(chart.baseSize).toBe(chart.wearer === "youth" ? "YM" : "M");
  });

  it("are garment measurements laid flat, so a chest is about half a body, never a whole one", () => {
    for (const chart of charts.filter((entry) => entry.points.some((point) => point.pointId === "chest-width"))) {
      const chest = base(chart, "chest-width");
      expect(chest, `${chart.garmentType} for ${chart.wearer}`).toBeGreaterThan(38);
      expect(chest, `${chart.garmentType} for ${chart.wearer}`).toBeLessThan(66);
    }
  });

  it("keep the parts of a garment in a sensible order at every size", () => {
    for (const chart of charts) {
      const run = DEFAULT_CHART_SET.runs.find((candidate) => candidate.id === chart.sizeRunId);
      for (const size of run?.sizes ?? []) {
        const has = (id: string) => chart.points.some((point) => point.pointId === id);
        const at = (id: string) => cmAt(chart, id, size);
        const where = `${chart.garmentType} for ${chart.wearer} at ${size}`;
        if (has("waist-stretched")) expect(at("waist-stretched"), where).toBeGreaterThan(at("waist-relaxed"));
        if (has("hip")) expect(at("hip"), where).toBeGreaterThan(at("waist-relaxed"));
        if (has("back-rise")) expect(at("back-rise"), where).toBeGreaterThan(at("front-rise"));
        if (has("outseam")) expect(at("outseam"), where).toBeGreaterThan(at("inseam"));
        if (has("thigh")) expect(at("thigh"), where).toBeGreaterThan(at("leg-opening"));
        if (has("knee")) expect(at("knee"), where).toBeLessThan(at("thigh"));
        if (has("front-neck-drop")) expect(at("front-neck-drop"), where).toBeGreaterThan(at("back-neck-drop"));
        if (has("shoulder-width")) expect(at("shoulder-width"), where).toBeLessThan(at("chest-width"));
        if (has("upper-arm")) expect(at("upper-arm"), where).toBeGreaterThan(at("sleeve-opening"));
        if (has("zip-length")) expect(at("zip-length"), where).toBeLessThan(at("body-length"));
        if (has("hood-width")) expect(at("hood-width"), where).toBeLessThan(at("hood-height"));
      }
    }
  });

  it("make youth garments smaller than adult ones, and long sleeves longer than short ones", () => {
    for (const typeId of LAUNCH_GARMENTS) {
      const youth = chartFor(typeId, "youth");
      const men = chartFor(typeId, "men");
      const first = youth.points[0]?.pointId ?? "";
      const lengthPoint = youth.points.some((point) => point.pointId === "body-length") ? "body-length" : "outseam";
      expect(base(youth, lengthPoint), typeId).toBeLessThan(base(men, lengthPoint));
      expect(first.length).toBeGreaterThan(0);
    }
    for (const wearer of ["men", "women", "youth"] as const) {
      expect(base(chartFor("long-sleeve-tee", wearer), "sleeve-length")).toBeGreaterThan(
        base(chartFor("crew-tee", wearer), "sleeve-length") * 2,
      );
      expect(base(chartFor("v-neck-tee", wearer), "front-neck-drop")).toBeGreaterThan(
        base(chartFor("crew-tee", wearer), "front-neck-drop"),
      );
      expect(base(chartFor("joggers", wearer), "inseam")).toBeGreaterThan(base(chartFor("shorts", wearer), "inseam") * 2);
    }
  });
});

describe("a new design with the starter charts", () => {
  const sized = (typeId: string, wearer: Wearer): GarmentSpec => {
    const spec = start(typeId, wearer);
    const sizing = sizingFromChart(spec);
    if (!sizing.ok) throw new Error(sizing.reason);
    const applied = applyAction(spec, sizing.action);
    if (!applied.ok) throw new Error(applied.reason);
    return applied.spec;
  };

  it("gets the sizes of the chart and a suggested value for every point at every size", () => {
    for (const [typeId, wearer] of pairs) {
      const spec = sized(typeId, wearer);
      const all = resolveAllSizes(spec);
      expect(all.entries.length).toBeGreaterThan(4);
      for (const entry of all.entries) {
        expect(entry.resolution.status, `${typeId} for ${wearer}`).toBe("resolved");
        for (const row of entry.resolution.rows) {
          expect(row.status, `${typeId} for ${wearer} ${row.pointId} at ${entry.size}`).toBe("set");
          if (row.status === "set") expect(row.provenance).toBe("suggested-chart");
        }
      }
    }
  });

  it("says the values are Knitwright suggestions to check with the factory", () => {
    const resolution = resolveMeasurements(sized("crew-tee", "men"), "M");
    expect(resolution.status).toBe("resolved");
    if (resolution.status !== "resolved") return;
    expect(resolution.chartNote).toBe(
      "These measurements are suggestions from the Knitwright starter chart, not a factory's numbers. Check them with your factory before you order.",
    );
  });

  it("keeps a value the person typed, and grades the other sizes from it with the chart's steps", () => {
    const spec = sized("crew-tee", "men");
    const typed = applyAction(spec, { type: "set-measurement", pointId: "body-length", value: 7500, provenance: "user-edited" });
    if (!typed.ok) throw new Error(typed.reason);
    const at = (size: string) => {
      const resolution = resolveMeasurements(typed.spec, size);
      return resolution.rows.find((row) => row.pointId === "body-length");
    };
    expect(at("M")).toMatchObject({ status: "set", value: 7500, provenance: "user-edited" });
    expect(at("L")).toMatchObject({ status: "set", value: 7750, provenance: "derived" });
  });

  it("gives way to a chart the brand imported for the same garment and wearer", () => {
    const run = { id: "brand-men", wearer: "men" as const, sizes: ["S", "M", "L"] };
    const brand: BrandChart = {
      run,
      chart: {
        wearer: "men",
        garmentType: "crew-tee",
        fit: "slim",
        sizeRunId: run.id,
        baseSize: "M",
        points: [{ pointId: "chest-width", baseValue: 5000, grade: { kind: "even", step: 200 }, tolerance: 100 }],
        source: { person: "Brand Person", date: "2026-10-01" },
        supplier: "brand",
      },
    };
    const set = withBrandCharts(DEFAULT_CHART_SET, [brand]);
    const spec = applyAction(start("crew-tee", "men"), { type: "set-option", optionId: "fit", choiceId: "regular", provenance: "user-edited" });
    if (!spec.ok) throw new Error(spec.reason);
    const resolution = resolveMeasurements(spec.spec, "M", set);
    expect(resolution.status).toBe("no-chart");
    const slim = applyAction(spec.spec, { type: "set-option", optionId: "fit", choiceId: "slim", provenance: "user-edited" });
    if (!slim.ok) throw new Error(slim.reason);
    const own = resolveMeasurements(slim.spec, "M", set);
    expect(own.status).toBe("resolved");
    if (own.status !== "resolved") return;
    expect(own.chartProvenance).toBe("brand-supplied");
    expect(own.chartNote).toBeNull();
    expect(own.rows.find((row) => row.pointId === "chest-width")).toMatchObject({ value: 5000, provenance: "brand-supplied" });
  });
});

describe("the starter chart sources", () => {
  const doc = readFileSync(new URL("../../../../docs/sizing/starter-charts.md", import.meta.url), "utf8");

  it("are written down for every garment and wearer, with links", () => {
    for (const [typeId, wearer] of pairs) {
      expect(doc, `${typeId} for ${wearer}`).toContain(`\`${typeId}\` for ${wearer}`);
    }
    expect((doc.match(/https:\/\//g) ?? []).length).toBeGreaterThan(15);
    expect(doc).toContain("not a factory's numbers");
  });
});
