import { describe, expect, it } from "vitest";
import {
  aqlColumnsOf,
  describeAql,
  describeLevel,
  describePlan,
  EMPTY_AQL_TABLE,
  letterFor,
  planFor,
  type AcceptanceRow,
  type AqlTable,
  type SamplePlanRow,
} from "./plan";

const plan = (over: Partial<SamplePlanRow> = {}): SamplePlanRow => ({
  codeLetter: "C",
  inspectionLevel: "II",
  lotMin: 16,
  lotMax: 25,
  sampleSize: 5,
  source: null,
  verified: false,
  ruleId: "R-QC-001",
  label: "Unverified",
  ...over,
});

const accept = (over: Partial<AcceptanceRow> = {}): AcceptanceRow => ({
  codeLetter: "C",
  aql: 2.5,
  defectClass: "major",
  acceptAt: 0,
  rejectAt: 1,
  useCodeLetter: null,
  source: null,
  verified: false,
  ruleId: "R-QC-001",
  label: "Unverified",
  ...over,
});

/** Two bands and one arrow: A points at C, which has the numbers. */
const table: AqlTable = {
  plans: [plan({ codeLetter: "A", lotMin: 2, lotMax: 8, sampleSize: 2 }), plan(), plan({ codeLetter: "H", lotMin: 281, lotMax: null, sampleSize: 50 })],
  acceptance: [
    accept({ codeLetter: "A", acceptAt: null, rejectAt: null, useCodeLetter: "C" }),
    accept(),
    accept({ codeLetter: "H", acceptAt: 3, rejectAt: 4 }),
    accept({ codeLetter: "A", aql: 0, defectClass: "critical" }),
    accept({ codeLetter: "C", aql: 0, defectClass: "critical" }),
    accept({ codeLetter: "H", aql: 0, defectClass: "critical" }),
  ],
};

describe("letterFor", () => {
  it("finds the band a lot falls in, including the band with no upper bound", () => {
    expect(letterFor(table, 2)?.codeLetter).toBe("A");
    expect(letterFor(table, 8)?.codeLetter).toBe("A");
    expect(letterFor(table, 20)?.codeLetter).toBe("C");
    expect(letterFor(table, 900_000)?.codeLetter).toBe("H");
  });

  it("has no answer for a lot no row covers, and none for another inspection level", () => {
    expect(letterFor(table, 1)).toBeNull();
    expect(letterFor(table, 10)).toBeNull();
    expect(letterFor(table, 20, "III")).toBeNull();
  });
});

describe("planFor", () => {
  it("names what is missing when the table is empty, rather than a sample size", () => {
    const answer = planFor(EMPTY_AQL_TABLE, 300);
    expect(answer.status).toBe("not-on-file");
    if (answer.status === "not-on-file") expect(answer.missing[0]).toContain("level II");
  });

  it("gives the code letter, the sample size and every AQL column on file", () => {
    const answer = planFor(table, 300);
    expect(answer.status).toBe("on-file");
    if (answer.status !== "on-file") return;
    expect([answer.codeLetter, answer.sampleSize]).toEqual(["H", 50]);
    expect(answer.levels.map((l) => [l.aql, l.acceptAt, l.rejectAt])).toEqual([
      [0, 0, 1],
      [2.5, 3, 4],
    ]);
  });

  it("follows an arrow to the letter that holds the numbers, and says which letter they came from", () => {
    const answer = planFor(table, 5);
    expect(answer.status).toBe("on-file");
    if (answer.status !== "on-file") return;
    const major = answer.levels.find((l) => l.aql === 2.5);
    expect([answer.codeLetter, answer.sampleSize]).toEqual(["A", 2]);
    expect([major?.codeLetter, major?.sampleSize, major?.acceptAt]).toEqual(["C", 5, 0]);
  });

  it("is not verified while any row it was built from is unverified", () => {
    const answer = planFor(table, 300);
    expect(answer.status === "on-file" && answer.verified).toBe(false);
    const checked: AqlTable = {
      plans: table.plans.map((p) => ({ ...p, verified: true, source: "ISO 2859-1" })),
      acceptance: table.acceptance.map((a) => ({ ...a, verified: true, source: "ISO 2859-1" })),
    };
    const after = planFor(checked, 300);
    expect(after.status === "on-file" && after.verified).toBe(true);
  });

  it("says the numbers are missing when the band exists but no column resolves", () => {
    const answer = planFor({ plans: [plan()], acceptance: [] }, 20);
    expect(answer.status).toBe("not-on-file");
    if (answer.status === "not-on-file") expect(answer.missing[0]).toContain("code letter C");
  });

  it("refuses an arrow that points at a letter with no plan, and one that loops", () => {
    const dangling: AqlTable = { plans: [plan()], acceptance: [accept({ acceptAt: null, rejectAt: null, useCodeLetter: "Z" })] };
    expect(planFor(dangling, 20).status).toBe("not-on-file");
    const loop: AqlTable = {
      plans: [plan(), plan({ codeLetter: "D", lotMin: 26, lotMax: 50, sampleSize: 8 })],
      acceptance: [
        accept({ acceptAt: null, rejectAt: null, useCodeLetter: "D" }),
        accept({ codeLetter: "D", acceptAt: null, rejectAt: null, useCodeLetter: "C" }),
      ],
    };
    expect(planFor(loop, 20).status).toBe("not-on-file");
  });
});

describe("the words", () => {
  it("writes an AQL as the spec writes it", () => {
    expect([describeAql(0), describeAql(2.5), describeAql(4)]).toEqual(["0", "2.5", "4.0"]);
  });

  it("lists the AQL columns the table holds, smallest first, once each", () => {
    expect(aqlColumnsOf(table)).toEqual([0, 2.5]);
    expect(aqlColumnsOf(EMPTY_AQL_TABLE)).toEqual([]);
  });

  it("describes a plan, and says plainly when there is none", () => {
    expect(describePlan(planFor(table, 300), 300)).toBe("Code letter H, 50 pieces inspected out of 300.");
    expect(describePlan(planFor(EMPTY_AQL_TABLE, 300), 300)).toBe("No sampling plan is on file for a lot of 300 pieces.");
  });

  it("writes one piece as a piece", () => {
    const one: AqlTable = { plans: [plan({ sampleSize: 1 })], acceptance: [accept()] };
    expect(describePlan(planFor(one, 20), 20)).toContain("1 piece inspected");
  });

  it("describes an accept and reject number", () => {
    expect(
      describeLevel({ aql: 2.5, defectClass: "major", acceptAt: 3, rejectAt: 4, codeLetter: "H", sampleSize: 50, verified: false, ruleId: "R-QC-001", label: "Unverified" }),
    ).toBe("Accept at 3, reject at 4.");
  });
});
