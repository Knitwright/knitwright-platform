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
      "STARTER_CHART_NAME",
      "withChartValues",
    ]) {
      expect(sizing).toHaveProperty(name);
    }
  });

  it("ships the Knitwright starter charts and says what is still missing through the completeness report", () => {
    const report = sizing.chartCompleteness();
    expect(sizing.DEFAULT_CHARTS.length).toBe(39);
    expect(report.withChart).toBe(39);
    // Leggings, the sports bra and the compression top are not offered at launch and have no starter chart yet.
    expect(report.entries.filter((entry) => !entry.hasChart).map((entry) => `${entry.typeId}/${entry.wearer}`)).toEqual([
      "leggings/men",
      "leggings/women",
      "leggings/youth",
      "sports-bra/women",
      "sports-bra/youth",
      "compression-top/men",
      "compression-top/women",
      "compression-top/youth",
    ]);
  });
});
