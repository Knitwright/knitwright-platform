import { describe, expect, it } from "vitest";
import { RULE_ID } from "@/lib/catalogue";
import type { ValidationCheck } from "@/lib/validation/check";
import { draftForEditor } from "./draft";
import { defaultForm } from "./form";
import { jersey, withSample } from "./fixtures/article";
import { findingLines, validateChip } from "./validate";

/** The Validate chip and its list. Every line has a rule, so every line has a Why?. */

const check = (patch: Partial<ValidationCheck> = {}): ValidationCheck => ({
  code: "print-dpi",
  severity: "warning",
  message: "The crest is 120 DPI at print size.",
  target: { article: null, panel: "front" },
  ruleId: "R-SUB-004",
  passed: false,
  ...patch,
});

const sampled = () => withSample(jersey(), "C01", "body_length_offset");
const base = () => ({ checks: [], draft: null, article: null, form: { options: {}, parameters: {} } }) as const;

describe("the chip", () => {
  it("says a version nothing has checked has not been checked, rather than showing a tick", () => {
    expect(validateChip(base())).toMatchObject({ label: "Not checked yet", tone: "unchecked", count: 0 });
  });

  it("shows the tick when every stored check passed and the form raises nothing", () => {
    const chip = validateChip({ ...base(), checks: [check({ passed: true, severity: null })] });

    expect(chip).toMatchObject({ label: "Validate ✓", tone: "clear", count: 0 });
    expect(chip.description).toBe("Everything the platform checks is clear.");
  });

  it("counts the blockers when there are any", () => {
    const chip = validateChip({ ...base(), checks: [check({ severity: "blocker" }), check({ code: "seam-crossing" })] });

    expect(chip).toMatchObject({ label: "1 to fix", tone: "blocked", count: 2 });
    expect(chip.description).toBe("2 things to look at, 1 of them blocking.");
  });

  it("counts warnings in words, and one warning in the singular", () => {
    expect(validateChip({ ...base(), checks: [check()] })).toMatchObject({ label: "1 thing to look at", tone: "warning" });
    expect(validateChip({ ...base(), checks: [check(), check({ code: "bleed" })] }).label).toBe("2 things to look at");
  });
});

describe("the findings list", () => {
  it("puts blockers first and gives every line a rule", () => {
    const lines = findingLines({ ...base(), checks: [check({ code: "bleed" }), check({ code: "gamut", severity: "blocker" })] });

    expect(lines.map((line) => line.severity)).toEqual(["blocker", "warning"]);
    for (const line of lines) expect(line.ruleId).toMatch(RULE_ID);
  });

  it("names the panel a finding is about", () => {
    expect(findingLines({ ...base(), checks: [check()] })[0]?.target).toBe("front");
  });

  it("adds what the drafter said about a value the article does not offer", () => {
    const draft = draftForEditor("JSY-SS-01", "M", { options: {}, parameters: { body_length_offset: 500 } });
    const lines = findingLines({ ...base(), draft, article: sampled(), form: defaultForm(jersey()) });

    expect(lines.some((line) => line.severity === "blocker" && line.message.includes("body_length_offset"))).toBe(true);
  });

  it("says when an article is not drafted yet, with the rule the drafter named or the gap id", () => {
    const draft = draftForEditor("TEE-TR-01", "M", { options: {}, parameters: {} });
    const lines = findingLines({ ...base(), draft });

    expect(lines[0]).toMatchObject({ severity: "warning", ruleId: "R-GAP-000" });
    expect(lines[0]?.message).toContain("Not drafted yet");
  });

  it("lists every option and range no golden sample has signed off", () => {
    const lines = findingLines({ ...base(), article: jersey(), form: defaultForm(jersey()) });

    expect(lines.map((line) => line.message)).toContain("Collar C01 has no golden sample behind it yet.");
    for (const line of lines) expect(line.ruleId).toMatch(RULE_ID);
  });

  it("says nothing about an option a sample has signed off", () => {
    const lines = findingLines({ ...base(), article: sampled(), form: defaultForm(jersey()) });

    expect(lines.map((line) => line.message)).not.toContain("Collar C01 has no golden sample behind it yet.");
  });

  it("counts a finding once, however many times it is reported", () => {
    const lines = findingLines({ ...base(), checks: [check(), check()] });

    expect(lines).toHaveLength(1);
  });

  it("carries the drafter's own warning about a range no sample has signed off", () => {
    const draft = draftForEditor("JSY-SS-01", "M", { options: {}, parameters: { body_length_offset: 20 } });
    const lines = findingLines({ ...base(), draft });

    expect(lines.some((line) => line.key === "draft:parameters.body_length_offset")).toBe(true);
  });
});
