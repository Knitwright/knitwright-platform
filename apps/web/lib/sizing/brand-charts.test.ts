import { createSpec, type GarmentSpec } from "@/lib/garment";
import { describe, expect, it } from "vitest";
import { withBrandCharts } from "./brand-charts";
import type { ChartSet } from "./chart-set";
import { madeUpChart } from "./fixtures/made-up-charts";
import { MADE_UP_MEN_RUN, MADE_UP_RUNS } from "./fixtures/made-up-size-runs";
import { resolveMeasurements } from "./resolve";
import type { SizeChart, SizeRun } from "./schemas";

const brandRun: SizeRun = { id: "brand-men-crew-tee-any", wearer: "men", sizes: ["B1", "B2", "B3", "B4", "B5"] };
const brandChart = (fit: SizeChart["fit"] = null): SizeChart => ({
  ...madeUpChart("crew-tee", "men", fit),
  sizeRunId: brandRun.id,
  baseSize: "B3",
  supplier: "brand",
});

const platform: ChartSet = {
  runs: MADE_UP_RUNS,
  charts: [madeUpChart("crew-tee", "men"), madeUpChart("crew-tee", "men", "slim"), madeUpChart("polo", "men")],
};

function crewTee(fit?: string): GarmentSpec {
  const made = createSpec("crew-tee", "men");
  if (!made.ok) throw new Error(made.reason);
  if (fit === undefined) return made.spec;
  return { ...made.spec, options: { ...made.spec.options, fit: { choiceId: fit, provenance: "user-edited" } } };
}

describe("withBrandCharts", () => {
  it("gives back the platform charts when the brand has none", () => {
    expect(withBrandCharts(platform, [])).toEqual(platform);
  });

  it("puts a brand's chart in place of every platform chart for the same wearer and garment", () => {
    const set = withBrandCharts(platform, [{ run: brandRun, chart: brandChart() }]);
    expect(set.charts.filter((chart) => chart.garmentType === "crew-tee")).toEqual([brandChart()]);
    expect(set.charts.some((chart) => chart.garmentType === "polo")).toBe(true);
    expect(set.runs).toContainEqual(brandRun);
    expect(set.runs).toContainEqual(MADE_UP_MEN_RUN);
  });

  it("means a design of any fit uses the brand's chart, not a platform chart for its fit", () => {
    const set = withBrandCharts(platform, [{ run: brandRun, chart: brandChart() }]);
    const result = resolveMeasurements(crewTee("slim"), "B2", set);
    expect(result.status).toBe("resolved");
  });

  it("changes neither input", () => {
    const before = JSON.stringify(platform);
    withBrandCharts(platform, [{ run: brandRun, chart: brandChart() }]);
    expect(JSON.stringify(platform)).toBe(before);
  });
});

describe("resolveMeasurements with a brand's chart", () => {
  const set = withBrandCharts({ runs: [], charts: [] }, [{ run: brandRun, chart: brandChart() }]);

  it("marks every value from the brand's own chart as supplied by the brand", () => {
    for (const size of brandRun.sizes) {
      const result = resolveMeasurements(crewTee(), size, set);
      const set_ = result.rows.filter((row) => row.status === "set");
      expect(set_.length).toBeGreaterThan(0);
      for (const row of set_) expect(row).toMatchObject({ provenance: "brand-supplied" });
    }
  });

  it("still marks a value graded from a typed value as worked out", () => {
    const spec = { ...crewTee(), measurements: [{ pointId: "chest-width", value: 5000, provenance: "user-edited" as const }] };
    const row = resolveMeasurements(spec, "B5", set).rows.find((entry) => entry.pointId === "chest-width");
    expect(row).toMatchObject({ provenance: "derived" });
  });

  it("keeps a platform chart's values as suggestions", () => {
    const row = resolveMeasurements(crewTee(), "T3", platform).rows.find((entry) => entry.pointId === "chest-width");
    expect(row).toMatchObject({ provenance: "suggested-chart" });
  });
});
