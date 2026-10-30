import { describe, expect, it } from "vitest";
import { deltaVerdict, evidenceFindings, offBy, pomVerdict, type MeasuredPom } from "./judge";

const pom = (over: Partial<MeasuredPom> = {}): MeasuredPom => ({
  letter: "A",
  measuredMm: 532,
  targetMm: 530,
  tolMinusMm: 10,
  tolPlusMm: 10,
  ruleId: "R-GAP-000",
  ...over,
});

describe("a measured point of measure", () => {
  it("is inside the tolerance it was judged against", () => {
    const verdict = pomVerdict(pom());
    expect(verdict).toMatchObject({ status: "inside", offByMm: 2 });
    expect(verdict.status === "inside" && verdict.text).toContain("2 mm off");
  });

  it("is outside it at either end", () => {
    expect(pomVerdict(pom({ measuredMm: 545 }))).toMatchObject({ status: "outside", offByMm: 15 });
    expect(pomVerdict(pom({ measuredMm: 515 }))).toMatchObject({ status: "outside", offByMm: -15 });
    const verdict = pomVerdict(pom({ measuredMm: 545 }));
    expect(verdict.status === "outside" && verdict.finding.severity).toBe("blocker");
  });

  it("counts the ends of the tolerance as inside", () => {
    expect(pomVerdict(pom({ measuredMm: 540 })).status).toBe("inside");
    expect(pomVerdict(pom({ measuredMm: 520 })).status).toBe("inside");
  });

  it("cannot be judged with no tolerance on file, and says so instead of guessing one", () => {
    const verdict = pomVerdict(pom({ tolPlusMm: null }));
    expect(verdict.status).toBe("cannot-judge");
    expect(verdict.status === "cannot-judge" && verdict.finding.code).toBe("pom_no_tolerance");
    expect(verdict.status === "cannot-judge" && verdict.finding.message).toContain("question for the factory");
    expect(pomVerdict(pom({ tolMinusMm: null })).status).toBe("cannot-judge");
  });

  it("cannot be judged with no value on file for the size", () => {
    expect(offBy(pom({ targetMm: null }))).toBeNull();
    const verdict = pomVerdict(pom({ targetMm: null }));
    expect(verdict.status === "cannot-judge" && verdict.finding.code).toBe("pom_no_target");
  });

  it("keeps the rule of the point it came from", () => {
    expect(pomVerdict(pom({ targetMm: null, ruleId: "R-PAT-005" })).status === "cannot-judge").toBe(true);
    const verdict = pomVerdict(pom({ measuredMm: 600, ruleId: "R-PAT-005" }));
    expect(verdict.status === "outside" && verdict.finding.ruleId).toBe("R-PAT-005");
  });
});

describe("a colour reading", () => {
  it("is inside the factory's own limit", () => {
    const verdict = deltaVerdict("Club navy", 1.2, 1.5);
    expect(verdict.status).toBe("inside");
    expect(verdict.status === "inside" && verdict.text).toContain("within the 1.5");
  });

  it("is over it", () => {
    const verdict = deltaVerdict("Club navy", 2.4, 1.5);
    expect(verdict.status).toBe("outside");
    expect(verdict.status === "outside" && verdict.finding.severity).toBe("blocker");
  });

  it("says nothing passes or fails when no limit is set", () => {
    const verdict = deltaVerdict("Club navy", 2.4, null);
    expect(verdict.status).toBe("no-limit");
    expect(verdict.status === "no-limit" && verdict.finding.message).toContain("No colour tolerance is set");
  });

  it("gathers the findings of a panel's evidence", () => {
    const found = evidenceFindings([pomVerdict(pom()), pomVerdict(pom({ tolPlusMm: null })), deltaVerdict("Navy", 3, 1.5)]);
    expect(found.map((f) => f.code)).toEqual(["pom_no_tolerance", "delta_outside_limit"]);
  });
});
