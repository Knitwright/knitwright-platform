import { describe, expect, it } from "vitest";
import { appTier } from "./fixtures/rows";
import { describeTier, formatMoney, ladderProblem, priceBasket, priceFor, tierFor } from "./pricing";

/**
 * Prices from the rows (spec F-T5: "price per piece by tier, with tiers counted across the whole basket",
 * and "the numbers match checkout to the penny"). The club ladder in the fixtures is the build pack's
 * placeholder: 10-19 at GBP 29, 20-49 at GBP 25, 50+ at GBP 22.
 */

const CLUB = [appTier(10, 19, 2900), appTier(20, 49, 2500), appTier(50, null, 2200)];
const WITH_AUD = [appTier(10, null, 2900, 5400)];

describe("tierFor", () => {
  it("finds the tier a quantity falls in, at both ends and in the open last tier", () => {
    expect(tierFor(CLUB, 10)?.qtyMin).toBe(10);
    expect(tierFor(CLUB, 19)?.qtyMin).toBe(10);
    expect(tierFor(CLUB, 20)?.qtyMin).toBe(20);
    expect(tierFor(CLUB, 5_000)?.qtyMin).toBe(50);
  });

  it("finds nothing below the smallest tier, whatever order the tiers come in", () => {
    expect(tierFor(CLUB, 9)).toBeNull();
    expect(tierFor([...CLUB].reverse(), 25)?.qtyMin).toBe(20);
  });
});

describe("priceFor", () => {
  it("multiplies the tier price by the quantity in minor units, exactly", () => {
    expect(priceFor(CLUB, 12, "GBP")).toMatchObject({ status: "priced", unitMinor: 2900, lineMinor: 34_800, currency: "GBP", tierQty: 12, tier: { qtyMin: 10, qtyMax: 19 } });
    expect(priceFor(CLUB, 50, "GBP")).toMatchObject({ status: "priced", unitMinor: 2200, lineMinor: 110_000, tier: { qtyMin: 50, qtyMax: null } });
  });

  it("reads the tier at the basket's quantity when one is given", () => {
    expect(priceFor(CLUB, 10, "GBP", 60)).toMatchObject({ status: "priced", unitMinor: 2200, lineMinor: 22_000, tierQty: 60 });
  });

  it("says so rather than guessing when there is no ladder, no tier or no price in that currency", () => {
    expect(priceFor([], 10, "GBP")).toEqual({ status: "not-made", reason: "No price ladder for this article." });
    expect(priceFor(CLUB, 9, "GBP")).toEqual({ status: "below-tiers", reason: "No tier covers 9 pieces. The smallest tier starts at 10." });
    expect(priceFor(CLUB, 12, "AUD")).toEqual({ status: "not-set", reason: "No AUD price is set for 10-19 pieces." });
    expect(priceFor(WITH_AUD, 12, "AUD")).toMatchObject({ status: "priced", unitMinor: 5400 });
  });

  it("refuses a quantity that is not a whole number of one or more, or a basket smaller than the line", () => {
    expect(() => priceFor(CLUB, 0, "GBP")).toThrow(RangeError);
    expect(() => priceFor(CLUB, 1.5, "GBP")).toThrow(RangeError);
    expect(() => priceFor(CLUB, 10, "GBP", 5)).toThrow(RangeError);
  });
});

describe("priceBasket", () => {
  it("counts the tier across the whole basket: ten jerseys and ten shorts are both at the 20-piece tier", () => {
    const basket = priceBasket([{ articleCode: "JSY-SS-01", qty: 10, ladder: CLUB }, { articleCode: "SHO-TR-01", qty: 10, ladder: CLUB }], "GBP");
    expect(basket.tierQty).toBe(20);
    expect(basket.lines.map((l) => l.price)).toMatchObject([{ unitMinor: 2500 }, { unitMinor: 2500 }]);
    expect(basket.totalMinor).toBe(50_000);
  });

  it("has no total while any line has no price, and none for an empty basket", () => {
    const basket = priceBasket([{ articleCode: "JSY-SS-01", qty: 10, ladder: CLUB }, { articleCode: "SHO-TR-01", qty: 10, ladder: [] }], "GBP");
    expect(basket.totalMinor).toBeNull();
    expect(basket.lines[1]?.price.status).toBe("not-made");
    expect(priceBasket([], "GBP")).toMatchObject({ tierQty: 0, totalMinor: null });
  });
});

describe("describeTier", () => {
  it("writes a closed tier and an open one", () => {
    expect(describeTier({ qtyMin: 10, qtyMax: 19 })).toBe("10-19");
    expect(describeTier({ qtyMin: 50, qtyMax: null })).toBe("50+");
  });
});

describe("ladderProblem", () => {
  it("passes a whole ladder, and an empty or single-tier one", () => {
    expect(ladderProblem(CLUB)).toBeNull();
    expect(ladderProblem([])).toBeNull();
    expect(ladderProblem([appTier(1, null, 100)])).toBeNull();
  });

  it("names an overlap, a gap and an open tier that is not the last", () => {
    expect(ladderProblem([appTier(10, 25, 2900), appTier(20, null, 2500)])).toBe("Tiers 10-25 and 20+ overlap.");
    expect(ladderProblem([appTier(10, 19, 2900), appTier(30, null, 2500)])).toBe("No tier covers 20 to 29 pieces.");
    expect(ladderProblem([appTier(10, null, 2900), appTier(50, null, 2200)])).toBe("Tier 10+ has no upper bound but another tier follows it.");
  });
});

describe("formatMoney", () => {
  it("shows pence as pounds and cents as dollars, for screens only", () => {
    expect(formatMoney(2900, "GBP")).toBe("£29.00");
    expect(formatMoney(5400, "AUD")).toBe("A$54.00");
    expect(formatMoney(0, "GBP")).toBe("£0.00");
  });
});
