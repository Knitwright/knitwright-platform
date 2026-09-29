import { describe, expect, it } from "vitest";
import * as sizing from "./index";

describe("the sizing public surface", () => {
  it("exports the functions and data other code needs", () => {
    for (const name of [
      "resolveMeasurements",
      "resolveAllSizes",
      "sizingFromChart",
      "parseChartsCsv",
      "gradeChart",
      "chartCompleteness",
      "editMeasurementAction",
      "resetMeasurementAction",
      "buildChartSet",
      "sizeChartSchema",
      "sizeRunSchema",
      "DEFAULT_CHARTS",
    ]) {
      expect(sizing).toHaveProperty(name);
    }
  });

  it("ships no default charts and says so through the completeness report", () => {
    expect(sizing.DEFAULT_CHARTS).toEqual([]);
    expect(sizing.chartCompleteness().withChart).toBe(0);
  });
});
