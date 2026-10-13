import { describe, expect, it } from "vitest";
import { createSpec, type GarmentSpec } from "@/lib/garment";
import type { ChartSet } from "./chart-set";
import { MADE_UP_CHART_SET } from "./fixtures/made-up-charts";
import { resolveAllSizes } from "./resolve-all";
import { resolveMeasurements, type ResolutionRow } from "./resolve";

const NO_CHARTS: ChartSet = { runs: [], charts: [] };
const USER = "user-edited" as const;

function tee(patch: Partial<GarmentSpec> = {}): GarmentSpec {
  const made = createSpec("crew-tee", "men");
  if (!made.ok) throw new Error(made.reason);
  return { ...made.spec, ...patch };
}

const chest = (rows: readonly ResolutionRow[]): ResolutionRow => {
  const found = rows.find((row) => row.pointId === "chest-width");
  if (!found) throw new Error("No chest width.");
  return found;
};

describe("values typed for a size other than the base size", () => {
  it("fill a size that nothing could work out when there is no chart", () => {
    const spec = tee({
      sizing: { sizes: ["S", "M", "L"], baseSize: "M" },
      measurements: [{ pointId: "chest-width", value: 5200, provenance: USER }],
      sizeMeasurements: [{ pointId: "chest-width", size: "L", value: 5500, provenance: USER }],
    });
    expect(chest(resolveMeasurements(spec, "L", NO_CHARTS).rows)).toMatchObject({ status: "set", value: 5500, provenance: USER, note: null });
    expect(chest(resolveMeasurements(spec, "S", NO_CHARTS).rows)).toMatchObject({ status: "missing" });
  });

  it("are never used for the base size, which keeps the value of the measurement", () => {
    const spec = tee({
      sizing: { sizes: ["S", "M"], baseSize: "M" },
      measurements: [{ pointId: "chest-width", value: 5200, provenance: USER }],
      sizeMeasurements: [{ pointId: "chest-width", size: "M", value: 9999, provenance: USER }],
    });
    expect(chest(resolveMeasurements(spec, "M", NO_CHARTS).rows)).toMatchObject({ value: 5200 });
  });

  it("win over a value graded from a chart, and keep the chart's tolerance", () => {
    const spec = tee({ sizeMeasurements: [{ pointId: "chest-width", size: "T5", value: 6100, provenance: USER }] });
    const graded = chest(resolveMeasurements(tee(), "T5", MADE_UP_CHART_SET).rows);
    const typed = chest(resolveMeasurements(spec, "T5", MADE_UP_CHART_SET).rows);
    expect(typed).toMatchObject({ status: "set", value: 6100, provenance: USER });
    expect(graded.status === "set" && typed.status === "set" && typed.tolerance).toBe(graded.status === "set" && graded.tolerance);
  });
});

describe("tolerances typed by a person", () => {
  it("win over the chart's, at every size, and say they are the person's own", () => {
    const spec = tee({ tolerances: [{ pointId: "chest-width", value: 15, provenance: USER }] });
    for (const entry of resolveAllSizes(spec, MADE_UP_CHART_SET).entries) {
      expect(chest(entry.resolution.rows)).toMatchObject({ tolerance: 15, toleranceFrom: USER });
    }
  });

  it("stand with a typed value when there is no chart, and a row with no value keeps none", () => {
    const spec = tee({
      measurements: [{ pointId: "chest-width", value: 5200, provenance: USER }],
      tolerances: [
        { pointId: "chest-width", value: 10, provenance: USER },
        { pointId: "body-length", value: 10, provenance: USER },
      ],
    });
    const rows = resolveMeasurements(spec, "", NO_CHARTS).rows;
    expect(chest(rows)).toMatchObject({ tolerance: 10, toleranceFrom: USER });
    expect(rows.find((row) => row.pointId === "body-length")).toMatchObject({ status: "missing" });
  });
});
