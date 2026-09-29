import { describe, expect, it } from "vitest";
import { MADE_UP_CHARTS, MADE_UP_CHART_SET, madeUpChart } from "./fixtures/made-up-charts";
import { MADE_UP_MEN_RUN, MADE_UP_RUNS, MADE_UP_WOMEN_RUN } from "./fixtures/made-up-size-runs";
import { buildChartSet, checkChart, chartKey } from "./validate";

const crewMen = madeUpChart("crew-tee", "men");

describe("checkChart", () => {
  it("finds nothing wrong with the made-up charts", () => {
    for (const chart of MADE_UP_CHARTS) {
      const run = MADE_UP_RUNS.find((candidate) => candidate.id === chart.sizeRunId);
      expect(run).toBeDefined();
      if (run) expect(checkChart(chart, run)).toEqual([]);
    }
  });

  it("refuses a size run that belongs to another wearer", () => {
    const problems = checkChart({ ...crewMen, sizeRunId: MADE_UP_WOMEN_RUN.id }, MADE_UP_WOMEN_RUN);
    expect(problems[0]?.message).toContain("women");
  });

  it("refuses a size run with a different name from the one the chart names", () => {
    const problems = checkChart({ ...crewMen, sizeRunId: "other-run" }, MADE_UP_MEN_RUN);
    expect(problems[0]?.message).toContain("other-run");
  });

  it("refuses an unknown garment type", () => {
    const problems = checkChart({ ...crewMen, garmentType: "kilt" }, MADE_UP_MEN_RUN);
    expect(problems[0]).toMatchObject({ column: "garment_type" });
    expect(problems[0]?.message).toContain("kilt");
  });

  it("refuses a point of measure that does not belong to the garment type", () => {
    const stray = { ...(crewMen.points[0] as (typeof crewMen.points)[number]), pointId: "placket-length" };
    const problems = checkChart({ ...crewMen, points: [stray] }, MADE_UP_MEN_RUN);
    expect(problems[0]).toMatchObject({ column: "point_of_measure", pointId: "placket-length" });
    expect(problems[0]?.message).toContain("crew-tee");
  });

  it("refuses a point of measure that no garment has", () => {
    const stray = { ...(crewMen.points[0] as (typeof crewMen.points)[number]), pointId: "sock-height" };
    const problems = checkChart({ ...crewMen, points: [stray] }, MADE_UP_MEN_RUN);
    expect(problems[0]?.message).toContain("sock-height");
  });
});

describe("buildChartSet", () => {
  it("accepts the made-up set", () => {
    expect(buildChartSet(MADE_UP_RUNS, MADE_UP_CHARTS)).toEqual({ ok: true, set: MADE_UP_CHART_SET });
  });

  it("accepts an empty set", () => {
    expect(buildChartSet([], [])).toEqual({ ok: true, set: { runs: [], charts: [] } });
  });

  it("refuses a chart with no source", () => {
    const noSource = { ...crewMen, source: { person: "", date: "2000-01-01" } };
    const result = buildChartSet(MADE_UP_RUNS, [noSource]);
    expect(result.ok).toBe(false);
  });

  it("refuses a chart whose size run is missing", () => {
    const result = buildChartSet([MADE_UP_WOMEN_RUN], [crewMen]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems[0]).toContain("made-up-men");
  });

  it("refuses two size runs with one name, and a bad size run", () => {
    expect(buildChartSet([MADE_UP_MEN_RUN, MADE_UP_MEN_RUN], []).ok).toBe(false);
    expect(buildChartSet([{ ...MADE_UP_MEN_RUN, sizes: ["A", "A"] }], []).ok).toBe(false);
  });

  it("refuses two charts for the same wearer, type and fit", () => {
    const result = buildChartSet(MADE_UP_RUNS, [crewMen, crewMen]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.join(" ")).toContain("crew-tee");
  });

  it("allows a chart for a fit next to the chart for no fit", () => {
    expect(buildChartSet(MADE_UP_RUNS, [crewMen, madeUpChart("crew-tee", "men", "slim")]).ok).toBe(true);
  });

  it("refuses a chart that grades to zero", () => {
    const chart = { ...crewMen, points: [{ ...(crewMen.points[0] as (typeof crewMen.points)[number]), baseValue: 100 }] };
    expect(buildChartSet(MADE_UP_RUNS, [chart]).ok).toBe(false);
  });
});

describe("chartKey", () => {
  it("joins wearer, type and fit, with any for no fit", () => {
    expect(chartKey(crewMen)).toBe("men/crew-tee/any");
    expect(chartKey(madeUpChart("crew-tee", "men", "slim"))).toBe("men/crew-tee/slim");
  });
});
