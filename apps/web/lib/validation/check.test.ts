import { describe, expect, it } from "vitest";
import { checkOf, checksPass, passedCheck, validationCheckSchema } from "./check";
import { finding } from "./finding";
import type { RuledFinding } from "./registry";

const blocker = finding({ code: "seam-cross", severity: "blocker", article: "team-jersey", panel: "body-front", message: "Crosses a seam.", action: "Move it.", whoActs: "owner" });
const warning = finding({ code: "gamut-approx", severity: "warning", message: "An estimate.", action: "Ask the print house.", whoActs: "print-house" });

describe("a finding as a stored check", () => {
  it("carries the code, severity, message, target and the rule of its code", () => {
    expect(checkOf(blocker)).toEqual({
      code: "seam-cross",
      severity: "blocker",
      message: "Crosses a seam.",
      target: { article: "team-jersey", panel: "body-front" },
      ruleId: "R-SUB-004",
      passed: false,
    });
  });

  it("keeps a rule the finding names itself, such as the rule of a parameter's own range", () => {
    const own: RuledFinding = { ...blocker, code: "parameter-out-of-range", ruleId: "R-PAT-003" };
    expect(checkOf(own).ruleId).toBe("R-PAT-003");
  });

  it("falls back to the gap rule for a code no rulebook entry covers", () => {
    expect(checkOf({ ...warning, code: "brand-new-check" }).ruleId).toBe("R-GAP-000");
  });

  it("is the shape the database column holds", () => {
    for (const check of [checkOf(blocker), checkOf(warning), passedCheck("dpi", "R-SUB-003")]) {
      expect(validationCheckSchema.parse(check)).toEqual(check);
    }
  });

  it("refuses a check whose rule id is not a rule id, or whose code is not kebab case", () => {
    expect(validationCheckSchema.safeParse({ ...checkOf(blocker), ruleId: "SUB-4" }).success).toBe(false);
    expect(validationCheckSchema.safeParse({ ...checkOf(blocker), code: "Seam Cross" }).success).toBe(false);
  });
});

describe("a module that found nothing", () => {
  it("is one passing check with no severity and no target", () => {
    expect(passedCheck("parameters-in-range", "R-PAT-003")).toEqual({
      code: "parameters-in-range",
      severity: null,
      message: "Nothing found.",
      target: { article: null, panel: null },
      ruleId: "R-PAT-003",
      passed: true,
    });
  });
});

describe("whether a set of checks lets a design go on", () => {
  it("is false only when a blocker failed", () => {
    expect(checksPass([])).toBe(true);
    expect(checksPass([passedCheck("dpi", "R-SUB-003")])).toBe(true);
    expect(checksPass([checkOf(warning)])).toBe(true);
    expect(checksPass([checkOf(warning), checkOf(blocker)])).toBe(false);
  });
});
