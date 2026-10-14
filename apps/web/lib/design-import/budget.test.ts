import { describe, expect, it } from "vitest";
import { createBudget } from "./budget";

describe("budget", () => {
  it("allows 3 vision calls and 2 image edits and then refuses without counting", () => {
    const budget = createBudget();
    expect([1, 2, 3, 4].map(() => budget.takeVision())).toEqual([true, true, true, false]);
    expect([1, 2, 3].map(() => budget.takeEdit())).toEqual([true, true, false]);
    expect(budget.spent()).toEqual({ visionCalls: 3, imageEdits: 2 });
  });
  it("takes smaller limits", () => {
    const budget = createBudget({ visionCalls: 1, imageEdits: 0 });
    expect([budget.takeVision(), budget.takeVision(), budget.takeEdit()]).toEqual([true, false, false]);
  });
});
