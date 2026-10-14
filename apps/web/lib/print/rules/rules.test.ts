import { describe, expect, it } from "vitest";
import type { PrintRuleSet } from "@/lib/production/contract";
import { avoidedColours, deltaE, toLab } from "./colour";
import { avoidIssues, dpiIssue, effectiveDpi, fitText, largestWidthMm, lineIssue, numberIssues, textHeightIssues } from "./checks";

const none: PrintRuleSet = { minTextHeightMm: null, minLineMm: null, coloursToAvoid: [], numberRules: null };

describe("colour", () => {
  it("measures difference between colours and catches near ones", () => {
    expect(deltaE("#ffffff", "#ffffff")).toBe(0);
    expect(deltaE("#000000", "#ffffff")).toBeGreaterThan(90);
    expect(avoidedColours(["#fdfdfd", "#FDFDFD", "#1b2a49"], ["#ffffff"])).toEqual(["#fdfdfd"]);
    expect(avoidedColours(["#1b2a49"], [])).toEqual([]);
    expect(toLab("#000000")[0]).toBeCloseTo(0, 3);
    expect(() => toLab("red")).toThrow(RangeError);
  });
});

describe("dpi", () => {
  it("computes and warns in plain words", () => {
    expect(effectiveDpi(1000, 400)).toBeCloseTo(63.5);
    expect(largestWidthMm(1500, 150)).toBeCloseTo(254);
    expect(dpiIssue(96.2, 150)?.text).toBe(
      "This picture would print at about 96 dpi at this size. Your print house asks for 150 or more, so it may look soft. Use a larger file, or make it smaller on the shirt.",
    );
    expect(dpiIssue(150, 150)).toBeNull();
  });
});

describe("text", () => {
  it("keeps a name at the height asked when it fits", () => {
    const fit = fitText("RIVERA", 60, 330, none, "Name");
    expect(fit.heightMm).toBe(60);
    expect(fit.issues).toEqual([]);
  });

  it("steps a name down to fit, and says so", () => {
    const fit = fitText("HERNANDEZ", 60, 300, none, "Name");
    expect(fit.heightMm).not.toBeNull();
    expect(fit.heightMm!).toBeLessThan(60);
    expect(fit.widthMm).toBeLessThanOrEqual(300);
    expect(fit.issues[0]?.severity).toBe("note");
  });

  it("does not squeeze a name below the smallest height: it is left off and reported", () => {
    const fit = fitText("MONTGOMERY-SMITHE", 60, 330, none, "Name");
    expect(fit.heightMm).toBeNull();
    expect(fit.issues[0]).toMatchObject({ severity: "stop" });
    expect(fit.issues[0]?.text).toContain("Knitwright default");
    const ruled = fitText("MONTGOMERY-SMITHE", 60, 330, { ...none, minTextHeightMm: 40 }, "Name");
    expect(ruled.issues[0]?.text).not.toContain("Knitwright default");
  });

  it("warns when text is under the print house's smallest", () => {
    expect(textHeightIssues(20, { ...none, minTextHeightMm: 25 }, "Text")).toHaveLength(1);
    expect(textHeightIssues(30, { ...none, minTextHeightMm: 25 }, "Text")).toEqual([]);
    expect(fitText("AB", 20, 330, { ...none, minTextHeightMm: 25 }, "Name").issues).toHaveLength(1);
  });

  it("applies league number rules and thin line and colour rules", () => {
    const rules: PrintRuleSet = { ...none, minLineMm: 0.5, numberRules: { minHeightMm: 100, maxHeightMm: 300, allowedDigits: "99", source: "League A" } };
    expect(numberIssues("10", 250, rules)).toEqual([]);
    expect(numberIssues("10", 90, rules)).toHaveLength(1);
    expect(numberIssues("100", 250, rules)[0]?.text).toContain("highest number League A allows");
    expect(numberIssues("10", 10, none)).toEqual([]);
    expect(numberIssues("100", 250, { ...rules, numberRules: { ...rules.numberRules!, allowedDigits: null } })).toEqual([]);
    expect(lineIssue(0.2, rules, "Logo")).not.toBeNull();
    expect(lineIssue(0.9, rules, "Logo")).toBeNull();
    expect(lineIssue(0.1, none, "Logo")).toBeNull();
    expect(avoidIssues(["#ffffff"])).toHaveLength(1);
  });
});
