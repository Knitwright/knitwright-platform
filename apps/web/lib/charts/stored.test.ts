import { describe, expect, it } from "vitest";
import { madeUpChart } from "@/lib/sizing/fixtures/made-up-charts";
import { MADE_UP_MEN_RUN } from "@/lib/sizing/fixtures/made-up-size-runs";
import { brandChartFromRow, chartSummary } from "./stored";

const row = (overrides: Record<string, unknown> = {}) => ({
  chart: madeUpChart("crew-tee", "men"),
  run: MADE_UP_MEN_RUN,
  imported_at: "2026-09-29T10:00:00Z",
  ...overrides,
});

describe("brandChartFromRow", () => {
  it("reads a stored chart and marks it as the brand's own, whatever the row says", () => {
    const read = brandChartFromRow(row({ chart: { ...madeUpChart("crew-tee", "men"), supplier: "platform" } }));
    expect(read?.chart.supplier).toBe("brand");
    expect(read?.run).toEqual(MADE_UP_MEN_RUN);
  });

  it("ignores a row whose chart or run does not match the sizing schemas", () => {
    expect(brandChartFromRow(row({ chart: { nonsense: true } }))).toBeNull();
    expect(brandChartFromRow(row({ run: { id: "x" } }))).toBeNull();
    expect(brandChartFromRow(null)).toBeNull();
  });

  it("ignores a chart that names another size run", () => {
    expect(brandChartFromRow(row({ run: { ...MADE_UP_MEN_RUN, id: "other" } }))).toBeNull();
  });
});

describe("chartSummary", () => {
  it("describes a chart in plain words for the list of charts", () => {
    const read = brandChartFromRow(row());
    if (!read) throw new Error("Expected a chart.");
    expect(chartSummary(read)).toEqual({
      key: "men/crew-tee/any",
      garment: "Crew neck tee",
      wearer: "men",
      fit: "Every fit",
      sizes: "T1, T2, T3, T4, T5",
      baseSize: read.chart.baseSize,
      points: read.chart.points.length,
      source: "Test Person, 2000-01-01",
    });
  });
});
