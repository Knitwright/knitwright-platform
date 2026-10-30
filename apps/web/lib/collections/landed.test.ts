import { describe, expect, it } from "vitest";
import { priceFor } from "@/lib/factory/pricing";
import { dutyOn, landedCost, landedLineOf, noRates, tierLineOf } from "./landed";
import { gbRates, jerseyLadder } from "./fixtures/plan";

/**
 * Decision 0085: the landed unit cost of spec F-S10 is the price tier plus freight and duty, and
 * nothing else. The tier part is `priceFor` untouched, so a plan and a basket of the same pieces
 * cannot disagree. A rate nobody has set is a note saying so, never a zero.
 */

const input = (over: Partial<Parameters<typeof landedCost>[0]> = {}) => ({
  ladder: jerseyLadder,
  qty: 30,
  currency: "GBP" as const,
  rates: gbRates,
  ...over,
});

describe("landedCost", () => {
  it("adds freight and duty to the tier price of the quantity", () => {
    const cost = landedCost(input());
    expect(cost).toMatchObject({ status: "landed", tierUnitMinor: 2500, freightUnitMinor: 120, dutyUnitMinor: 314, unitMinor: 2934 });
  });

  it("keeps the tier part exactly what priceFor gives, to the penny", () => {
    const cost = landedCost(input({ qty: 30 }));
    const price = priceFor(jerseyLadder, 30, "GBP", 30);
    expect(price.status).toBe("priced");
    expect(tierLineOf(cost)).toBe(price.status === "priced" ? price.lineMinor : null);
    expect(tierLineOf(cost)).toBe(2500 * 30);
  });

  it("multiplies the landed unit by the quantity, so a line is exact in minor units", () => {
    const cost = landedCost(input({ qty: 30 }));
    expect(landedLineOf(cost)).toBe(2934 * 30);
  });

  it("reads the tier at the whole plan's quantity, not at the line's", () => {
    const cost = landedCost(input({ qty: 10, tierQty: 60 }));
    expect(cost).toMatchObject({ tierUnitMinor: 2200, tierLineMinor: 22_000 });
  });

  it("charges duty on the goods alone where the row says so", () => {
    const cost = landedCost(input({ rates: { ...gbRates, dutyBasis: "goods" } }));
    expect(cost).toMatchObject({ dutyUnitMinor: 300, unitMinor: 2920 });
  });

  it("rounds duty once, per piece, at the penny", () => {
    expect(dutyOn(2620, 1200)).toBe(314);
    expect(dutyOn(1, 1)).toBe(0);
    expect(dutyOn(10_000, 2000)).toBe(2000);
  });
});

describe("what is not on file", () => {
  it("leaves freight out and says so when no freight row exists", () => {
    const cost = landedCost(input({ rates: { ...gbRates, freightPerPieceMinor: null, freightCurrency: null } }));
    expect(cost).toMatchObject({ freightUnitMinor: 0, dutyUnitMinor: 300 });
    expect(cost.status === "landed" && cost.notes).toEqual(["No freight rate is on file for GB, so freight is not in this cost."]);
  });

  it("never converts a freight rate in another currency", () => {
    const cost = landedCost(input({ rates: { ...gbRates, freightCurrency: "AUD" } }));
    expect(cost).toMatchObject({ freightUnitMinor: 0 });
    expect(cost.status === "landed" && cost.notes[0]).toContain("is in AUD, not GBP");
  });

  it("leaves duty out where the article has no HS code", () => {
    const cost = landedCost(input({ rates: { ...gbRates, hsCode: null, dutyRateBp: null } }));
    expect(cost).toMatchObject({ dutyUnitMinor: 0, unitMinor: 2620 });
    expect(cost.status === "landed" && cost.notes[0]).toContain("no HS code on file");
  });

  it("leaves duty out where no rate covers the HS code into this country", () => {
    const cost = landedCost(input({ rates: { ...gbRates, dutyRateBp: null } }));
    expect(cost.status === "landed" && cost.notes[0]).toBe("No duty rate is on file for 6110.30 into GB, so duty is not in this cost.");
  });

  it("adds nothing at all for a destination with no rows", () => {
    const cost = landedCost(input({ rates: noRates("US") }));
    expect(cost).toMatchObject({ unitMinor: 2500, freightUnitMinor: 0, dutyUnitMinor: 0 });
    expect(cost.status === "landed" && cost.notes).toHaveLength(2);
  });
});

describe("where there is no price", () => {
  it("says no price is on file when the style has no ladder", () => {
    expect(landedCost(input({ ladder: [] }))).toEqual({ status: "no-price", qty: 30, reason: "No price is on file for this style's article yet." });
    expect(landedLineOf(landedCost(input({ ladder: [] })))).toBeNull();
    expect(tierLineOf(landedCost(input({ ladder: [] })))).toBeNull();
  });

  it("gives the ladder's own reason when no tier covers the quantity", () => {
    const cost = landedCost(input({ qty: 3 }));
    expect(cost.status).toBe("no-price");
    expect(cost.status === "no-price" && cost.reason).toContain("The smallest tier starts at 10.");
  });

  it("has no price for a style with no pieces planned", () => {
    expect(landedCost(input({ qty: 0 }))).toEqual({ status: "no-price", qty: 0, reason: "This style has no pieces planned yet." });
  });

  it("says so where no price is set in this currency", () => {
    const cost = landedCost(input({ currency: "AUD" }));
    expect(cost.status === "no-price" && cost.reason).toContain("No AUD price is set");
  });
});

describe("where every figure came from", () => {
  it("carries the tier's label and the rows' labels, so a screen can print them", () => {
    const cost = landedCost(input());
    expect(cost.status === "landed" && cost.labels).toEqual([
      "Test row, not a factory quote",
      "Test freight row, not a carrier quote",
      "Test country rule, not a customs opinion",
    ]);
    expect(cost.status === "landed" && cost.ruleIds).toEqual(["R-GAP-000"]);
  });
});
