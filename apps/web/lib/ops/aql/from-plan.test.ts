import { describe, expect, it, vi } from "vitest";
import type { AqlPlan } from "@/lib/compliance/rows";
import { factoryIdOf, limitsOfPlan, loadAqlPlans, samplingFor } from "./from-plan";
import type { AcceptanceRow, AqlTable, SamplePlanRow } from "./plan";

const planRow = (over: Partial<SamplePlanRow> = {}): SamplePlanRow => ({
  codeLetter: "H",
  inspectionLevel: "II",
  lotMin: 281,
  lotMax: 500,
  sampleSize: 50,
  source: null,
  sourced: false,
  ruleId: "R-QC-001",
  label: "No source cited",
  ...over,
});

const accept = (aql: number, acceptAt: number, defectClass: AcceptanceRow["defectClass"]): AcceptanceRow => ({
  codeLetter: "H",
  aql,
  defectClass,
  acceptAt,
  rejectAt: acceptAt + 1,
  useCodeLetter: null,
  source: null,
  sourced: false,
  ruleId: "R-QC-001",
  label: "No source cited",
});

/** The table holds four columns; the factory's plan names only three of them. */
const table: AqlTable = {
  plans: [planRow()],
  acceptance: [accept(0, 0, "critical"), accept(2.5, 3, "major"), accept(4, 5, "minor"), accept(6.5, 7, "minor")],
};

const aqlPlan = (over: Partial<AqlPlan> = {}): AqlPlan => ({
  id: "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a11",
  factoryId: null,
  scope: "run",
  inspectEveryPiece: false,
  inspectionLevel: "II",
  criticalAql: 0,
  majorAql: 2.5,
  minorAql: 4,
  source: "Rulebook R-QC-001",
  confirmed: false,
  ruleId: "R-QC-001",
  label: "Placeholder from rulebook R-QC-001",
  ...over,
});

describe("limitsOfPlan", () => {
  it("takes the limits the row holds, critical first, and leaves out the rest", () => {
    expect(limitsOfPlan(aqlPlan())).toEqual([0, 2.5, 4]);
    expect(limitsOfPlan(aqlPlan({ criticalAql: null, minorAql: null }))).toEqual([2.5]);
    expect(limitsOfPlan(aqlPlan({ criticalAql: null, majorAql: null, minorAql: null }))).toEqual([]);
  });
});

describe("samplingFor", () => {
  it("says nothing is on file when no AQL plan covers the factory and scope", () => {
    expect(samplingFor([], table, { factoryId: null, lotSize: 400 })).toEqual({ status: "no-plan" });
  });

  it("looks up only the levels the factory's own plan names, not every column the table holds", () => {
    const answer = samplingFor([aqlPlan()], table, { factoryId: null, lotSize: 400 });
    expect(answer.status).toBe("sampled");
    if (answer.status !== "sampled" || answer.sampling.status !== "on-file") throw new Error("expected a sampled plan");
    expect(answer.sampling.levels.map((l) => l.aql)).toEqual([0, 2.5, 4]);
    expect(answer.sampling.sampleSize).toBe(50);
  });

  it("prefers the factory's own plan over the one for every factory", () => {
    const every = aqlPlan({ majorAql: 2.5 });
    const own = aqlPlan({ id: "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a12", factoryId: "f-1", criticalAql: null, majorAql: 2.5, minorAql: null });
    const answer = samplingFor([every, own], table, { factoryId: "f-1", lotSize: 400 });
    if (answer.status !== "sampled" || answer.sampling.status !== "on-file") throw new Error("expected a sampled plan");
    expect(answer.sampling.levels.map((l) => l.aql)).toEqual([2.5]);
  });

  it("asks for no sample size at all when the plan inspects every piece", () => {
    const answer = samplingFor([aqlPlan({ inspectEveryPiece: true, scope: "class_a_sample", inspectionLevel: null })], table, {
      factoryId: null,
      lotSize: 400,
      scope: "class_a_sample",
    });
    expect(answer.status).toBe("every-piece");
  });

  it("treats a plan with no level as one that names no sample size", () => {
    const answer = samplingFor([aqlPlan({ inspectionLevel: null, inspectEveryPiece: true })], table, { factoryId: null, lotSize: 400 });
    expect(answer.status).toBe("every-piece");
  });

  it("says what the sampling table is missing when the plan names a level it has nothing for", () => {
    const answer = samplingFor([aqlPlan({ inspectionLevel: "III" })], table, { factoryId: null, lotSize: 400 });
    if (answer.status !== "sampled") throw new Error("expected a sampled plan");
    expect(answer.sampling.status).toBe("not-on-file");
    if (answer.sampling.status === "not-on-file") expect(answer.sampling.missing[0]).toContain("level III");
  });
});

describe("loadAqlPlans", () => {
  const row = {
    id: "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a11",
    factory_id: null,
    scope: "run",
    inspect_every_piece: false,
    inspection_level: "II",
    critical_aql: "0.0",
    major_aql: "2.5",
    minor_aql: "4.0",
    source: "Rulebook R-QC-001",
    confirmed: false,
    rule_id: "R-QC-001",
    label: "Placeholder",
  };

  it("reads the plans, leaving out a row it cannot make sense of", async () => {
    const from = vi.fn(() => ({ select: () => ({ limit: async () => ({ data: [row, { id: 7 }], error: null }) }) }));
    const plans = await loadAqlPlans({ from } as never);
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ inspectionLevel: "II", majorAql: 2.5 });
  });

  it("gives none when the read fails or throws, so the screen says nothing is on file", async () => {
    const bad = vi.fn(() => ({ select: () => ({ limit: async () => ({ data: null, error: { message: "no" } }) }) }));
    expect(await loadAqlPlans({ from: bad } as never)).toEqual([]);
    const thrown = vi.fn(() => {
      throw new Error("down");
    });
    expect(await loadAqlPlans({ from: thrown } as never)).toEqual([]);
  });
});

describe("factoryIdOf", () => {
  const reader = (data: unknown) => vi.fn(() => ({ select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data }) }) }) }) }));

  it("finds the factory's id by its slug", async () => {
    expect(await factoryIdOf({ from: reader({ id: "f-1" }) } as never, "sialkot-partner")).toBe("f-1");
  });

  it("answers null for a slug that names no factory, and when the read throws", async () => {
    expect(await factoryIdOf({ from: reader(null) } as never, "nobody")).toBeNull();
    const thrown = vi.fn(() => {
      throw new Error("down");
    });
    expect(await factoryIdOf({ from: thrown } as never, "nobody")).toBeNull();
  });
});
