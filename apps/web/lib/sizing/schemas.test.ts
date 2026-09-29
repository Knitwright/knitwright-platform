import { describe, expect, it } from "vitest";
import { MADE_UP_MEN_RUN } from "./fixtures/made-up-size-runs";
import { madeUpChart } from "./fixtures/made-up-charts";
import { sizeChartSchema, sizeRunSchema } from "./schemas";

const withSource = (source: unknown): unknown => ({ ...madeUpChart("crew-tee", "men"), source });

describe("sizeRunSchema", () => {
  it("accepts an ordered list of free text labels", () => {
    expect(sizeRunSchema.safeParse(MADE_UP_MEN_RUN).success).toBe(true);
    const youth = { id: "youth-run", wearer: "youth", sizes: ["6Y", "8Y", "10Y"] };
    expect(sizeRunSchema.safeParse(youth).success).toBe(true);
  });

  it("refuses repeated labels", () => {
    const result = sizeRunSchema.safeParse({ ...MADE_UP_MEN_RUN, sizes: ["M", "L", "M"] });
    expect(result.success).toBe(false);
  });

  it("refuses empty labels, a run of one size and an unknown wearer", () => {
    expect(sizeRunSchema.safeParse({ ...MADE_UP_MEN_RUN, sizes: ["M", "  "] }).success).toBe(false);
    expect(sizeRunSchema.safeParse({ ...MADE_UP_MEN_RUN, sizes: ["M"] }).success).toBe(false);
    expect(sizeRunSchema.safeParse({ ...MADE_UP_MEN_RUN, wearer: "pets" }).success).toBe(false);
  });
});

describe("sizeChartSchema", () => {
  it("accepts a chart that names a person and a date", () => {
    expect(sizeChartSchema.safeParse(madeUpChart("crew-tee", "men")).success).toBe(true);
    expect(sizeChartSchema.safeParse(madeUpChart("crew-tee", "men", "slim")).success).toBe(true);
  });

  it("refuses a chart with no source, no person or no date", () => {
    expect(sizeChartSchema.safeParse(withSource(undefined)).success).toBe(false);
    expect(sizeChartSchema.safeParse(withSource({ person: "", date: "2026-10-02" })).success).toBe(false);
    expect(sizeChartSchema.safeParse(withSource({ person: "Test Person", date: "" })).success).toBe(false);
    expect(sizeChartSchema.safeParse(withSource({ person: "Test Person" })).success).toBe(false);
  });

  it("refuses a person that is only a placeholder or has no letters", () => {
    for (const person of ["TBC", "unknown", "n/a", "12345", "  "]) {
      expect(sizeChartSchema.safeParse(withSource({ person, date: "2026-10-02" })).success).toBe(false);
    }
  });

  it("refuses a date that is not a real calendar day", () => {
    for (const date of ["2026-13-01", "2026-02-30", "02/10/2026", "2026-1-2"]) {
      expect(sizeChartSchema.safeParse(withSource({ person: "Test Person", date })).success).toBe(false);
    }
  });

  it("refuses a point listed twice, an unknown fit and decimals", () => {
    const chart = madeUpChart("crew-tee", "men");
    const first = chart.points[0];
    expect(sizeChartSchema.safeParse({ ...chart, points: [first, first] }).success).toBe(false);
    expect(sizeChartSchema.safeParse({ ...chart, fit: "tight" }).success).toBe(false);
    expect(
      sizeChartSchema.safeParse({ ...chart, points: [{ ...first, baseValue: 2000.5 }] }).success,
    ).toBe(false);
  });

  it("refuses a zero tolerance, a zero base value and a chart with no points", () => {
    const chart = madeUpChart("crew-tee", "men");
    const first = chart.points[0];
    expect(sizeChartSchema.safeParse({ ...chart, points: [{ ...first, tolerance: 0 }] }).success).toBe(false);
    expect(sizeChartSchema.safeParse({ ...chart, points: [{ ...first, baseValue: 0 }] }).success).toBe(false);
    expect(sizeChartSchema.safeParse({ ...chart, points: [] }).success).toBe(false);
  });
});
