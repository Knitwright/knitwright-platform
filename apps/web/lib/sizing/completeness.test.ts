import { describe, expect, it } from "vitest";
import { listTypes } from "@/lib/garment";
import { chartCompleteness } from "./completeness";
import { MADE_UP_CHART_SET, madeUpChart } from "./fixtures/made-up-charts";
import { MADE_UP_RUNS } from "./fixtures/made-up-size-runs";
import { deepFreeze } from "./fixtures/freeze";

const PAIR_COUNT = listTypes().reduce((total, type) => total + type.wearers.length, 0);

describe("chartCompleteness", () => {
  it("lists every garment type and wearer and says none has a chart when there are no charts", () => {
    const report = chartCompleteness();
    expect(report.entries).toHaveLength(PAIR_COUNT);
    expect(PAIR_COUNT).toBe(15);
    expect(report.entries.every((entry) => !entry.hasChart)).toBe(true);
    expect(report.complete).toBe(false);
    expect(report.withChart).toBe(0);
    expect(report.summary).toBe("0 of 15 garment and wearer pairs have a size chart. 15 still need one.");
    expect(report.entries[0]?.message).toContain("No size chart yet");
  });

  it("marks a pair complete when a chart and its size run exist", () => {
    const set = { runs: MADE_UP_RUNS, charts: [madeUpChart("polo", "youth"), madeUpChart("polo", "youth", "slim")] };
    const report = chartCompleteness(deepFreeze(set));
    const polo = report.entries.find((entry) => entry.typeId === "polo" && entry.wearer === "youth");
    expect(polo).toMatchObject({ hasChart: true, fits: [null, "slim"] });
    expect(polo?.message).toContain("slim");
    expect(report.withChart).toBe(1);
  });

  it("does not count a chart whose size run is missing", () => {
    const report = chartCompleteness({ runs: [], charts: [madeUpChart("polo", "youth")] });
    expect(report.withChart).toBe(0);
  });

  it("is complete when every pair has a chart", () => {
    const report = chartCompleteness(MADE_UP_CHART_SET);
    expect(report.complete).toBe(true);
    expect(report.summary).toBe("15 of 15 garment and wearer pairs have a size chart. 0 still need one.");
    expect(report.entries[0]?.message).toContain("chart");
  });
});
