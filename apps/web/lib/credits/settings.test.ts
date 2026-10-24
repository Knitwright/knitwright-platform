import { describe, expect, it } from "vitest";
import { OUTPUT_KINDS } from "./kinds";
import { CREDIT_SETTINGS, PLACEHOLDER_NOTICE } from "./settings";

describe("the credit settings", () => {
  it("prices every chargeable output kind with a whole, non-negative number of credits", () => {
    for (const kind of OUTPUT_KINDS) {
      const price = CREDIT_SETTINGS.prices[kind];
      expect(Number.isInteger(price)).toBe(true);
      expect(price).toBeGreaterThanOrEqual(0);
    }
    expect(Object.keys(CREDIT_SETTINGS.prices).sort()).toEqual([...OUTPUT_KINDS].sort());
  });

  it("says plainly that the numbers are placeholders, not prices", () => {
    expect(CREDIT_SETTINGS.isPlaceholder).toBe(true);
    expect(PLACEHOLDER_NOTICE).toMatch(/placeholder/i);
    expect(PLACEHOLDER_NOTICE).toMatch(/not a price/i);
  });

  it("gives a whole, non-negative monthly allowance", () => {
    expect(Number.isInteger(CREDIT_SETTINGS.monthlyAllowance)).toBe(true);
    expect(CREDIT_SETTINGS.monthlyAllowance).toBeGreaterThanOrEqual(0);
  });
});
