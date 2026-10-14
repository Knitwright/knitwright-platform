import { describe, expect, it } from "vitest";
import {
  EMPTY_RULES,
  EMPTY_RULES_SENTENCE,
  SHIPPED_LEAGUE_RULE_SETS,
  colourProblem,
  leagueRuleSetSchema,
  numberProblems,
  rulesAreEmpty,
  textHeightProblem,
} from "./index";

const rules = {
  minTextHeightMm: 30,
  minLineMm: 0.5,
  coloursToAvoid: ["#ffff00"],
  numberRules: { minHeightMm: 200, maxHeightMm: 300, allowedDigits: "789", source: "Test league rules, section 4" },
};

describe("print rules", () => {
  it("ships empty, and says so", () => {
    expect(rulesAreEmpty(EMPTY_RULES)).toBe(true);
    expect(EMPTY_RULES_SENTENCE).toMatch(/No league rules set/);
    expect(SHIPPED_LEAGUE_RULE_SETS).toEqual([]);
  });
  it("finds no problem when no rule is set", () => {
    expect(textHeightProblem(1, EMPTY_RULES)).toBeNull();
    expect(colourProblem("#ffff00", EMPTY_RULES)).toBeNull();
    expect(numberProblems("7", 5, EMPTY_RULES)).toEqual([]);
  });
  it("reports text below the minimum height", () => {
    expect(textHeightProblem(25, rules)).toMatch(/30 mm/);
    expect(textHeightProblem(30, rules)).toBeNull();
  });
  it("reports a colour on the avoid list, in any letter case", () => {
    expect(colourProblem("#FFFF00", rules)).toMatch(/sublimates badly/);
    expect(colourProblem("#ff0000", rules)).toBeNull();
  });
  it("tests a number's height and digits against the league rules, naming the source", () => {
    expect(numberProblems("7", 150, rules)[0]).toMatch(/200 to 300 mm/);
    expect(numberProblems("7", 250, rules)).toEqual([]);
    expect(numberProblems("7", 350, rules)[0]).toMatch(/Test league rules, section 4/);
    expect(numberProblems("7", 250, { ...rules, numberRules: { ...rules.numberRules, allowedDigits: "123" } })[0]).toMatch(/digit/);
  });
  it("requires a source on every league rule", () => {
    const ok = { id: "test", name: "Test league", source: "Competition rules 2026, s4", rules };
    expect(leagueRuleSetSchema.safeParse(ok).success).toBe(true);
    expect(leagueRuleSetSchema.safeParse({ ...ok, source: "" }).success).toBe(false);
  });
});
