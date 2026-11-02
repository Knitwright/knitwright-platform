import { describe, expect, it } from "vitest";
import { RULE_ID } from "@/lib/rulebook/constants";
import { SEEDED_NOT_DRAFTED, notDraftedSource } from "@/lib/parametric/articles";
import { NO_MEASUREMENT_LINE, gapForArticle, gapForType, hasGap } from "./gaps";

describe("the gap behind a template's article", () => {
  it("names one for each of the seven articles with no measurement on file", () => {
    const codes = SEEDED_NOT_DRAFTED.all().map((entry) => entry.code);
    expect(codes).toHaveLength(7);
    for (const code of codes) {
      const gap = gapForArticle(code);
      expect(gap, code).not.toBeNull();
      expect(gap!.line).toBe(NO_MEASUREMENT_LINE);
      expect(gap!.ruleId).toMatch(RULE_ID);
      expect(gap!.needs.length).toBeGreaterThan(0);
    }
  });

  it("names none for the one article with a factory-shaped brief", () => {
    expect(gapForArticle("JSY-SS-01")).toBeNull();
    expect(hasGap("team-jersey")).toBe(false);
  });

  it("takes the rule from the article's own brief and writes none of its own", () => {
    for (const entry of SEEDED_NOT_DRAFTED.all()) expect(gapForArticle(entry.code)!.ruleId).toBe(entry.rule);
  });

  it("finds the gap from the garment type a design is drawn on", () => {
    // Hoodies and the compression top are two of the seven; the team jersey is JSY-SS-01.
    expect(gapForType("pullover-hoodie")!.ruleId).toBe("R-PAT-501");
    expect(gapForType("compression-top")!.ruleId).toBe("R-PAT-601");
    expect(gapForType("football-shirt")).toBeNull();
    expect(hasGap("zip-hoodie")).toBe(true);
  });

  it("says nothing about a garment type the catalogue maps to no article", () => {
    // Socks, caps, leggings and jackets are registry types with no base article (decision 0066).
    expect(gapForType("football-socks")).toBeNull();
    expect(hasGap("football-socks")).toBe(false);
  });

  it("reads the register it is given, so a factory's own register replaces the seed", () => {
    const empty = notDraftedSource([]);
    expect(gapForArticle("HOD-ST-01", empty)).toBeNull();
    expect(gapForType("pullover-hoodie", empty)).toBeNull();
    expect(hasGap("pullover-hoodie", empty)).toBe(false);
  });
});
