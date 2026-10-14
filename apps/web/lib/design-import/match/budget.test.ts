import { describe, expect, it } from "vitest";
import { budgetSentence, createMatchBudget, MATCH_LIMITS } from "./budget";

describe("match budget", () => {
  it("counts renders and comparisons and refuses past the limit", () => {
    const budget = createMatchBudget({ renders: 2, comparisons: 10, milliseconds: 1000 }, () => 0);
    expect([budget.takeRender(), budget.takeRender(), budget.takeRender()]).toEqual([true, true, false]);
    expect(budget.spent()).toEqual({ renders: 2, comparisons: 0, stoppedEarly: true });
    const second = createMatchBudget({ renders: 5, comparisons: 10, milliseconds: 1000 }, () => 0);
    expect([second.takeComparisons(6), second.takeComparisons(6)]).toEqual([true, false]);
    expect(second.spent()).toMatchObject({ comparisons: 6, stoppedEarly: true });
  });
  it("stops when the clock runs out and never starts again", () => {
    let now = 0;
    const budget = createMatchBudget({ renders: 5, comparisons: 100, milliseconds: 50 }, () => now);
    expect(budget.takeRender()).toBe(true);
    now = 60;
    expect(budget.late()).toBe(true);
    expect(budget.takeRender()).toBe(false);
    expect(budget.takeComparisons(1)).toBe(false);
    now = 0;
    expect(budget.late()).toBe(true);
  });
  it("states its limits in words", () => {
    expect(budgetSentence()).toBe(`Pattern matching is limited to ${MATCH_LIMITS.renders} trial drawings, ${MATCH_LIMITS.comparisons / 1_000_000} million pixel comparisons and ${MATCH_LIMITS.milliseconds / 1000} seconds for each picture.`);
  });
});
