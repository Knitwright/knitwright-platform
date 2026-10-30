import { describe, expect, it } from "vitest";
import { RULEBOOK_MD } from "./fixtures/files";
import { parseRulebookMarkdown } from "./markdown";
import { asksTheFactory, isSupplierList, misfiledAsFactory, sourceOf } from "./sources";

/**
 * Owner decision 13: a source says who actually said it. Read against the whole JSY-SS-01 rulebook, nothing is
 * filed as `factory` that a factory did not say, and `pattern_master` stays unused while owner decision 10 holds.
 */

const rules = parseRulebookMarkdown(RULEBOOK_MD, "JSY-SS-01");
const noteOf = (ruleId: string): string => rules.find((rule) => rule.ruleId === ruleId)?.sourceNote ?? "";
const filed = (ruleId: string) => ({ source: sourceOf(noteOf(ruleId)), sourceNote: noteOf(ruleId) });

describe("reading a source note", () => {
  it("files a supplier's price list under the supplier, not the factory", () => {
    expect(noteOf("R-COST-003")).toBe("Supplier price lists, May 2026; replace with partner quote");
    expect(isSupplierList(noteOf("R-COST-003"))).toBe(true);
    expect(filed("R-COST-003").source).toBe("supplier");
  });

  it("keeps the factory's own price list as the factory's word", () => {
    expect(noteOf("R-COST-002")).toBe("Factory price list");
    expect(filed("R-COST-002").source).toBe("factory");
  });

  it("does not take a request to the factory as the factory's word", () => {
    expect(asksTheFactory("Factory to confirm their RIP settings")).toBe(true);
    expect(asksTheFactory("Factory to measure")).toBe(true);
    expect(asksTheFactory("Factory price list")).toBe(false);
    expect(filed("R-SUB-003").source).toBe("knitwright");
    expect(filed("R-SUB-006").source).toBe("knitwright");
    expect(filed("R-CON-004").source).toBe("knitwright");
  });

  it("keeps Knitwright's drafts and the standards where they were", () => {
    expect(filed("R-PAT-001").source).toBe("knitwright");
    expect(filed("R-PAT-002").source).toBe("standard");
    expect(filed("R-FIT-003").source).toBe("standard");
    expect(sourceOf("")).toBe("standard");
  });
});

describe("a source filed as the factory", () => {
  it("is misfiled when the note only asks them, names a supplier, or says nothing at all", () => {
    expect(misfiledAsFactory({ source: "factory", sourceNote: "Factory to confirm" })).toBe(true);
    expect(misfiledAsFactory({ source: "factory", sourceNote: "Supplier price lists, May 2026" })).toBe(true);
    expect(misfiledAsFactory({ source: "factory", sourceNote: "" })).toBe(true);
    expect(misfiledAsFactory({ source: "factory", sourceNote: "Factory price list" })).toBe(false);
    expect(misfiledAsFactory({ source: "knitwright", sourceNote: "Factory to confirm" })).toBe(false);
  });
});

describe("the whole rulebook, read the way owner decision 13 asks", () => {
  it("files nothing as the factory that the factory did not say", () => {
    const wrong = rules.map((rule) => filed(rule.ruleId)).filter(misfiledAsFactory);
    expect(wrong).toEqual([]);
  });

  it("leaves only the factory's own price list filed as the factory", () => {
    const asFactory = rules.filter((rule) => filed(rule.ruleId).source === "factory").map((rule) => rule.ruleId);
    expect(asFactory).toEqual(["R-COST-002"]);
  });

  it("files nothing under pattern_master while owner decision 10 holds that no master pattern exists", () => {
    expect(rules.filter((rule) => filed(rule.ruleId).source === "pattern_master")).toEqual([]);
  });

  it("moves nine rules off the first reading, and no others", () => {
    const moved = rules.filter((rule) => sourceOf(rule.sourceNote) !== rule.source).map((rule) => rule.ruleId);
    expect(moved).toEqual([
      "R-CON-004",
      "R-CON-005",
      "R-CON-006",
      "R-CON-008",
      "R-SUB-003",
      "R-SUB-005",
      "R-SUB-006",
      "R-SUB-008",
      "R-COST-003",
    ]);
  });
});
