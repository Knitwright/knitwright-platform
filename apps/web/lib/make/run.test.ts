import { describe, expect, it } from "vitest";
import { checkRun, type RunClass } from "./run";
import { CLASS_B_MAX_PIECES, CLASS_B_MIN_PIECES } from "./vocabulary";

const check = (quantities: Readonly<Record<string, string>>, productionClass: RunClass = "B", moq: number | null = 1) =>
  checkRun({ quantities, productionClass, moq });

const codes = (quantities: Readonly<Record<string, string>>, productionClass: RunClass = "B", moq: number | null = 1) =>
  check(quantities, productionClass, moq).findings.map((f) => f.code);

describe("the pieces of a run", () => {
  it("adds up the sizes with a whole number of pieces", () => {
    const result = check({ S: "20", M: "40", L: "" });
    expect(result.sizes).toEqual({ S: 20, M: 40 });
    expect(result.pieces).toBe(60);
    expect(result.canSend).toBe(true);
  });

  it("needs a whole number", () => {
    expect(codes({ S: "ten" })).toContain("run_quantity_unreadable");
    expect(codes({ S: "2.5" })).toContain("run_quantity_unreadable");
    expect(codes({ S: "-4" })).toContain("run_quantity_unreadable");
  });

  it("needs pieces somewhere", () => {
    expect(codes({ S: "0", M: "" })).toContain("run_no_pieces");
    expect(check({}).canSend).toBe(false);
  });
});

describe("the production class", () => {
  it("notes a Class B run outside 50 to 300 pieces per style, and lets it go", () => {
    expect(codes({ M: String(CLASS_B_MIN_PIECES - 1) })).toContain("class_b_quantity");
    expect(codes({ M: String(CLASS_B_MAX_PIECES + 1) })).toContain("class_b_quantity");
    expect(codes({ M: String(CLASS_B_MIN_PIECES) })).not.toContain("class_b_quantity");
    expect(codes({ M: String(CLASS_B_MAX_PIECES) })).not.toContain("class_b_quantity");
  });

  it("says the range is Knitwright's own and does not refuse the run over it", () => {
    const over = check({ M: String(CLASS_B_MAX_PIECES + 100) });
    const found = over.findings.find((finding) => finding.code === "class_b_quantity");

    expect(found?.severity).toBe("warning");
    expect(found?.message).toContain("not a quantity a factory has refused");
    expect(over.canSend).toBe(true);
    expect(over.pieces).toBe(CLASS_B_MAX_PIECES + 100);
  });

  it("lets a Class A run be any quantity from one piece", () => {
    const result = check({ M: "1" }, "A");
    expect(result.canSend).toBe(true);
    expect(result.findings.map((f) => f.code)).not.toContain("class_b_quantity");
    expect(check({ M: "400" }, "A").canSend).toBe(true);
  });

  it("applies no range and says so when no base article gives the class", () => {
    const result = check({ M: "10" }, null);
    expect(result.canSend).toBe(true);
    expect(result.findings.map((f) => f.code)).toEqual(["class_not_set"]);
    expect(result.findings[0]?.severity).toBe("warning");
  });

  it("stops a run that breaks a rule from being sent, and keeps no quantity it could not read", () => {
    const result = check({ M: "ten" }, "B");
    expect(result.canSend).toBe(false);
    expect(result.sizes).toEqual({});
    expect(result.pieces).toBe(0);
  });
});

describe("the factory's minimum order", () => {
  it("notes a run under it without refusing it", () => {
    const result = check({ M: "60" }, "B", 100);
    expect(result.canSend).toBe(true);
    expect(result.findings.map((f) => f.code)).toEqual(["under_moq"]);
    expect(result.findings[0]?.message).toContain("100 pieces");
  });

  it("says when none is set", () => {
    expect(codes({ M: "60" }, "B", null)).toEqual(["moq_not_set"]);
  });

  it("explains every finding with a rule", () => {
    expect(check({ M: "1" }, "B", null).findings.every((f) => /^R-[A-Z]+-\d{3}$/.test(f.ruleId))).toBe(true);
  });
});
