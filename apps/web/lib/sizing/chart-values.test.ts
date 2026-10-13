import { describe, expect, it } from "vitest";
import { applyAction } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { withChartValues } from "./chart-values";
import { MADE_UP_CHART_SET } from "./fixtures/made-up-charts";

const EMPTY = { runs: [], charts: [] } as const;

describe("withChartValues", () => {
  it("adds the chart's value at the base size for each point the design has no value for, marked as suggested", () => {
    const spec = start("crew-tee", "men");

    const filled = withChartValues(spec);

    const chest = filled.measurements.find((entry) => entry.pointId === "chest-width");
    expect(chest).toEqual({ pointId: "chest-width", value: 5300, provenance: "suggested-chart" });
    expect(filled.measurements.length).toBeGreaterThan(8);
    expect(spec.measurements).toEqual([]);
  });

  it("keeps a value the person typed as it is", () => {
    const typed = applyAction(start("crew-tee", "men"), { type: "set-measurement", pointId: "chest-width", value: 5600, provenance: "user-edited" });
    if (!typed.ok) throw new Error(typed.reason);

    const filled = withChartValues(typed.spec);

    expect(filled.measurements.filter((entry) => entry.pointId === "chest-width")).toEqual([
      { pointId: "chest-width", value: 5600, provenance: "user-edited" },
    ]);
  });

  it("uses the chart it is given, and the design's own base size", () => {
    const sized = applyAction(start("crew-tee", "men"), { type: "set-sizing", sizing: { sizes: ["T1", "T2", "T3"], baseSize: "T2" } });
    if (!sized.ok) throw new Error(sized.reason);

    const filled = withChartValues(sized.spec, MADE_UP_CHART_SET);

    expect(filled.measurements.find((entry) => entry.pointId === "chest-width")).toMatchObject({ value: 1900, provenance: "suggested-chart" });
  });

  it("leaves the design as it is when no chart applies", () => {
    const spec = start("crew-tee", "men");
    expect(withChartValues(spec, EMPTY)).toBe(spec);
  });
});
