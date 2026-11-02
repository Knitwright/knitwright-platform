import { describe, expect, it, vi } from "vitest";
import { planFor } from "./plan";
import { readable, toAcceptance, toSamplePlan } from "./rows";
import { loadAqlTable } from "./service";

const planRow = {
  code_letter: "H",
  inspection_level: "II",
  lot_min: 281,
  lot_max: 500,
  sample_size: 50,
  source: null,
  verified: false,
  rule_id: "R-QC-001",
  label: "Unverified",
};

const acceptanceRow = {
  code_letter: "H",
  aql: "2.500",
  defect_class: "major",
  accept_at: 3,
  reject_at: 4,
  use_code_letter: null,
  source: null,
  verified: false,
  rule_id: "R-QC-001",
  label: "Unverified",
};

describe("reading the rows", () => {
  it("reads a sample plan row", () => {
    expect(toSamplePlan(planRow)).toEqual({
      codeLetter: "H",
      inspectionLevel: "II",
      lotMin: 281,
      lotMax: 500,
      sampleSize: 50,
      source: null,
      verified: false,
      ruleId: "R-QC-001",
      label: "Unverified",
    });
  });

  it("reads the AQL as a number, whichever way the driver gives the decimal", () => {
    expect(toAcceptance(acceptanceRow).aql).toBe(2.5);
    expect(toAcceptance({ ...acceptanceRow, aql: 4 }).aql).toBe(4);
  });

  it("leaves out a row it cannot read, and keeps the rest", () => {
    expect(readable([planRow, { code_letter: 7 }, planRow], toSamplePlan)).toHaveLength(2);
  });
});

const answer = (data: unknown[]) => ({ select: () => ({ order: () => ({ order: () => ({ limit: () => ({ data, error: null }) }), limit: () => ({ data, error: null }) }) }) });

describe("loadAqlTable", () => {
  it("reads both tables and builds a plan from them", async () => {
    const from = vi.fn((name: string) => answer(name === "ops_aql_sample_plans" ? [planRow] : [acceptanceRow]));
    const table = await loadAqlTable({ from } as never);
    expect(planFor(table, 300).status).toBe("on-file");
  });

  it("gives the empty table when a read fails, so the screen says nothing is on file", async () => {
    const from = vi.fn(() => ({ select: () => ({ order: () => ({ order: () => ({ limit: () => ({ data: null, error: { message: "no" } }) }), limit: () => ({ data: null, error: { message: "no" } }) }) }) }));
    expect(await loadAqlTable({ from } as never)).toEqual({ plans: [], acceptance: [] });
  });

  it("gives the empty table when the read throws", async () => {
    const from = vi.fn(() => {
      throw new Error("down");
    });
    expect(await loadAqlTable({ from } as never)).toEqual({ plans: [], acceptance: [] });
  });
});
