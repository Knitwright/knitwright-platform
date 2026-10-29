import { describe, expect, it } from "vitest";
import { RULEBOOK_MD } from "./fixtures/files";
import { familyOf, parseRulebookMarkdown, sourceFromNote } from "./markdown";

describe("reading the JSY-SS-01 rulebook", () => {
  const rules = parseRulebookMarkdown(RULEBOOK_MD, "JSY-SS-01");

  it("finds all 45 rules, each id once", () => {
    expect(rules).toHaveLength(45);
    expect(new Set(rules.map((r) => r.ruleId)).size).toBe(45);
  });

  it("counts the rules of each family as the file has them", () => {
    const count = (family: string) => rules.filter((r) => familyOf(r.ruleId) === family).length;
    expect([count("PAT"), count("FIT"), count("CON"), count("SUB"), count("PER"), count("LAB"), count("QC"), count("COST")]).toEqual([8, 8, 9, 8, 4, 3, 2, 3]);
  });

  it("keeps the words of R-SUB-004 exactly", () => {
    expect(rules.find((r) => r.ruleId === "R-SUB-004")).toEqual({
      ruleId: "R-SUB-004",
      topic: "print",
      articleCodes: [],
      title: "Seam crossings",
      rule: "Artwork that crosses a seam can be offset by up to 3 mm after sewing; critical elements keep 15 mm away from seams",
      body: "Each panel is printed and cut separately, then sewn; sewing shifts panels slightly",
      bestPractice: "Stripes across seams are fine if a small offset is acceptable; crests, numbers and text are not",
      source: "standard",
      sourceNote: "Sublimation practice",
      status: "draft",
    });
  });

  it("files the article's own rules under JSY-SS-01 and the shared families under every article", () => {
    expect(rules.find((r) => r.ruleId === "R-PAT-001")?.articleCodes).toEqual(["JSY-SS-01"]);
    expect(rules.find((r) => r.ruleId === "R-LAB-002")?.articleCodes).toEqual([]);
    expect(rules.every((r) => r.status === "draft")).toBe(true);
  });

  it("finds every cell of every rule filled", () => {
    for (const r of rules) {
      for (const value of [r.title, r.rule, r.body, r.bestPractice, r.sourceNote]) expect(value.length, r.ruleId).toBeGreaterThan(0);
    }
  });
});

describe("sourceFromNote", () => {
  it.each([
    ["Knitwright draft; factory to confirm their machine settings", "knitwright"],
    ["Factory to confirm rib source", "factory"],
    ["Factory price list", "factory"],
    ["Supplier price lists, May 2026; replace with partner quote", "factory"],
    ["Industry standard", "standard"],
    ["AQL standard (ISO 2859-1)", "standard"],
    ["Process physics", "standard"],
  ])("sorts %s as %s", (note, source) => {
    expect(sourceFromNote(note)).toBe(source);
  });
});

describe("rows it refuses", () => {
  it("refuses a row with a missing cell", () => {
    expect(() => parseRulebookMarkdown("| R-PAT-001 | a | b | c |", "X")).toThrow(/Not a rulebook row/);
  });

  it("refuses a family it has no topic for", () => {
    expect(() => parseRulebookMarkdown("| R-ZZZ-001 | a | b | c | d | e | draft |", "X")).toThrow(/No topic/);
  });

  it("ignores lines that are not rule rows", () => {
    expect(parseRulebookMarkdown("# Title\n| ID | Applies to |\n|---|---|", "X")).toEqual([]);
  });

  it("reads an id with no family as having none", () => {
    expect(familyOf("R")).toBe("");
  });
});
