import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_CHARTS, DEFAULT_CHART_SET, DEFAULT_SIZE_RUNS } from "./charts";
import { sizeChartSchema } from "./schemas";
import { buildChartSet } from "./validate";

const CHARTS_FOLDER = new URL("./charts/", import.meta.url);
/** Matches an import, a dynamic import or a require that reaches into a fixtures folder. */
const FIXTURE_IMPORT = /(?:from|import\s*\(|require\s*\()\s*["'][^"']*fixtures/;

const chartFiles = (): readonly string[] =>
  readdirSync(CHARTS_FOLDER).filter((name) => name.endsWith(".ts") && name !== "index.ts" && !name.endsWith(".test.ts"));

describe("the default charts that ship with the app", () => {
  it("come from chart files in the charts folder, with their size runs", () => {
    expect(chartFiles().length).toBeGreaterThan(0);
    expect(DEFAULT_CHARTS.length).toBeGreaterThan(0);
    expect(DEFAULT_SIZE_RUNS.length).toBeGreaterThan(0);
  });

  it("all name a person and a date as their source, and pass the full check", () => {
    for (const chart of DEFAULT_CHARTS) {
      expect(sizeChartSchema.safeParse(chart).success).toBe(true);
      expect(chart.source.person.trim().length).toBeGreaterThan(0);
      expect(chart.source.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(buildChartSet(DEFAULT_CHART_SET.runs, DEFAULT_CHART_SET.charts).ok).toBe(true);
  });

  it("never import from the fixtures folder of made-up numbers", () => {
    for (const name of ["index.ts", ...chartFiles()]) {
      const text = readFileSync(new URL(name, CHARTS_FOLDER), "utf8");
      expect(text, `${name} must not use made-up numbers`).not.toMatch(FIXTURE_IMPORT);
    }
  });

  it("keep the fixtures free of any import from the charts folder, so they cannot leak in by a loop", () => {
    const fixtures = new URL("./fixtures/", import.meta.url);
    for (const name of readdirSync(fixtures)) {
      const text = readFileSync(new URL(name, fixtures), "utf8");
      expect(text).not.toMatch(/from "\.\.\/charts/);
    }
  });

  it("are backed by fixture files that say plainly that they are made up", () => {
    const fixtures = new URL("./fixtures/", import.meta.url);
    for (const name of ["made-up-charts.ts", "made-up-size-runs.ts"]) {
      const text = readFileSync(new URL(name, fixtures), "utf8");
      expect(text).toContain("MADE-UP NUMBERS FOR TESTS ONLY");
      expect(text).toContain("must never be loaded as the default charts");
    }
  });
});
