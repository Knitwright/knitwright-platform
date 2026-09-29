import { describe, expect, it } from "vitest";
import { allowancesFrom, microdollars } from "./cost";

describe("microdollars", () => {
  it("converts dollars to whole microdollars", () => {
    expect(microdollars(0.0005)).toBe(500);
    expect(microdollars(20)).toBe(20_000_000);
    expect(microdollars(0.1 + 0.2)).toBe(300_000);
  });
});

describe("allowancesFrom", () => {
  it("groups the configured allowances by who they apply to", () => {
    expect(
      allowancesFrom({
        USAGE_USER_DAILY_AI: 1,
        USAGE_BRAND_DAILY_AI: 2,
        USAGE_USER_DAILY_PHOTOREAL: 3,
        USAGE_BRAND_DAILY_PHOTOREAL: 4,
        USAGE_GLOBAL_DAILY_CEILING: 5,
      }),
    ).toEqual({ user: { ai: 1, photoreal: 3 }, brand: { ai: 2, photoreal: 4 }, globalCeiling: 5 });
  });
});
