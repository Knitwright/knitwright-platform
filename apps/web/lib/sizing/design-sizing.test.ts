import { describe, expect, it } from "vitest";
import { applyAction, createSpec, specActionSchema, type GarmentSpec } from "@/lib/garment";
import { MADE_UP_CHART_SET, madeUpChart } from "./fixtures/made-up-charts";
import { deepFreeze } from "./fixtures/freeze";
import { MADE_UP_RUNS } from "./fixtures/made-up-size-runs";
import { resolveAllSizes } from "./resolve-all";
import { sizingFromChart } from "./sizing-from-chart";

function crewTee(sizing: GarmentSpec["sizing"] = null): GarmentSpec {
  const made = createSpec("crew-tee", "men");
  if (!made.ok) throw new Error(made.reason);
  return deepFreeze({ ...made.spec, sizing });
}

describe("sizingFromChart", () => {
  it("returns a set-sizing action with the chart sizes and base size", () => {
    const result = sizingFromChart(crewTee(), MADE_UP_CHART_SET);
    expect(result).toEqual({
      ok: true,
      action: { type: "set-sizing", sizing: { sizes: ["T1", "T2", "T3", "T4", "T5"], baseSize: "T3" } },
    });
  });

  it("gives an action the design contract accepts and applies", () => {
    const result = sizingFromChart(crewTee(), MADE_UP_CHART_SET);
    if (!result.ok) throw new Error(result.reason);
    expect(specActionSchema.safeParse(result.action).success).toBe(true);
    const applied = applyAction(crewTee(), result.action);
    expect(applied.ok && applied.spec.sizing?.baseSize).toBe("T3");
  });

  it("gives a plain reason when there is no chart", () => {
    const result = sizingFromChart(crewTee(), { runs: [], charts: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("no size chart");
  });

  it("leaves a design that already has sizing alone", () => {
    const result = sizingFromChart(crewTee({ sizes: ["S", "M"], baseSize: "M" }), MADE_UP_CHART_SET);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("already");
  });

  it("does not change the chart set", () => {
    const frozen = deepFreeze({ runs: [...MADE_UP_RUNS], charts: [madeUpChart("crew-tee", "men")] });
    expect(sizingFromChart(crewTee(), frozen).ok).toBe(true);
  });
});

describe("resolveAllSizes", () => {
  it("resolves every chart size when the design has no sizing, with the base marked", () => {
    const all = resolveAllSizes(crewTee(), MADE_UP_CHART_SET);
    expect(all.message).toBeNull();
    expect(all.sizesFrom).toBe("chart");
    expect(all.baseSize).toBe("T3");
    expect(all.entries.map((entry) => entry.size)).toEqual(["T1", "T2", "T3", "T4", "T5"]);
    expect(all.entries.filter((entry) => entry.isBase).map((entry) => entry.size)).toEqual(["T3"]);
    for (const entry of all.entries) expect(entry.resolution.status).toBe("resolved");
  });

  it("resolves every design size when the design has sizing", () => {
    const all = resolveAllSizes(crewTee({ sizes: ["T2", "T3", "T9"], baseSize: "T3" }), MADE_UP_CHART_SET);
    expect(all.sizesFrom).toBe("design");
    expect(all.entries.map((entry) => entry.size)).toEqual(["T2", "T3", "T9"]);
    expect(all.entries.find((entry) => entry.isBase)?.size).toBe("T3");
    expect(all.entries[2]?.resolution.rows.every((row) => row.status === "missing")).toBe(true);
  });

  it("says so, with no entries, when there is no chart and no design sizing", () => {
    const all = resolveAllSizes(crewTee(), { runs: [], charts: [] });
    expect(all).toMatchObject({ entries: [], baseSize: null, sizesFrom: null });
    expect(all.message).toContain("no size chart");
  });

  it("gives every size a no-chart result when the design has sizing but there is no chart", () => {
    const all = resolveAllSizes(crewTee({ sizes: ["S", "M"], baseSize: "S" }), { runs: [], charts: [] });
    expect(all.entries.map((entry) => entry.resolution.status)).toEqual(["no-chart", "no-chart"]);
    expect(all.message).toContain("no size chart");
  });

  it("reports a chart that cannot be graded", () => {
    const broken = { ...madeUpChart("crew-tee", "men"), baseSize: "ZZ" };
    const all = resolveAllSizes(crewTee(), { runs: MADE_UP_RUNS, charts: [broken] });
    expect(all.message).toContain("cannot be used");
  });
});
