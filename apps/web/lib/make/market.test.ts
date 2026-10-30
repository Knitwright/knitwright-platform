import { describe, expect, it } from "vitest";
import { DEFAULT_MARKET, marketOf } from "./market";

describe("the market a page is shown in", () => {
  it("takes the two markets the price tiers hold", () => {
    expect(marketOf("GBP")).toBe("GBP");
    expect(marketOf("AUD")).toBe("AUD");
    expect(marketOf(["AUD", "GBP"])).toBe("AUD");
  });

  it("falls back to the United Kingdom for anything else, so no price is shown in a currency with no tier", () => {
    expect(marketOf(undefined)).toBe(DEFAULT_MARKET);
    expect(marketOf("USD")).toBe(DEFAULT_MARKET);
    expect(marketOf([])).toBe(DEFAULT_MARKET);
  });
});
