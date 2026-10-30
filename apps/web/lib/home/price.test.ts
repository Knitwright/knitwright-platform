import { describe, expect, it } from "vitest";
import { appTier } from "@/lib/factory/fixtures/rows";
import { cheapestTier, fromPrice, ladderRows } from "./price";
import { MARKETS, marketFromQuery, marketHref } from "./market";

/**
 * Decision 0074: the "From £x · from 1 pc" line and the price ladder, from X6's tiers (decision
 * 0071). No price is ever invented, and no placeholder is ever shown without its label: the line
 * carries the tier's own stored label and its rule id.
 *
 * The seeded ladder of JSY-SS-01 is the build pack's club ladder: 10-19 at £29, 20-49 at £25,
 * 50+ at £22, with no AUD price at all.
 */

const CLUB_LADDER = [appTier(10, 19, 2900), appTier(20, 49, 2500), appTier(50, null, 2200)];

describe("the cheapest tier", () => {
  it("is the one with the lowest price in that currency, whatever order the tiers come in", () => {
    expect(cheapestTier([...CLUB_LADDER].reverse(), "GBP")?.qtyMin).toBe(50);
  });

  it("is null where no tier carries a price in that currency", () => {
    expect(cheapestTier(CLUB_LADDER, "AUD")).toBeNull();
    expect(cheapestTier([], "GBP")).toBeNull();
  });
});

describe("the From line of a catalogue card", () => {
  it("reads the cheapest price and the factory's own smallest order", () => {
    const price = fromPrice({ ladder: CLUB_LADDER, moq: 1 }, "GBP");
    expect(price.line).toBe("From £22.00 · from 1 pc");
    expect(price.priced).toBe(true);
    expect(price.label).toBe("Test row, not a factory quote");
    expect(price.ruleId).toBe("R-COST-003");
  });

  it("says so where the smallest order the factory takes has no tier covering it", () => {
    expect(fromPrice({ ladder: CLUB_LADDER, moq: 1 }, "GBP").note).toBe("Priced from 10 pcs; no price is set for 1 pc yet.");
    expect(fromPrice({ ladder: CLUB_LADDER, moq: 25 }, "GBP").note).toBeNull();
  });

  it("falls back to the tier's own range where no minimum order is stored", () => {
    const price = fromPrice({ ladder: CLUB_LADDER, moq: null }, "GBP");
    expect(price.line).toBe("From £22.00 · 50+ pcs");
    expect(price.note).toBeNull();
  });

  it("says no price is set rather than showing a price in the wrong currency", () => {
    const price = fromPrice({ ladder: CLUB_LADDER, moq: 1 }, "AUD");
    expect(price.line).toBe("No AUD price is set yet · from 1 pc");
    expect(price.priced).toBe(false);
    expect(price.label).toBeNull();
    expect(price.ruleId).toBe("R-GAP-000");
  });

  it("says no price is set for an article with no tiers at all, and names no quantity", () => {
    const price = fromPrice({ ladder: [], moq: null }, "GBP");
    expect(price.line).toBe("No GBP price is set yet");
    expect(price.quantity).toBeNull();
    expect(price.note).toBeNull();
  });

  it("counts one piece in the singular and more in the plural", () => {
    expect(fromPrice({ ladder: CLUB_LADDER, moq: 2 }, "GBP").quantity).toBe("from 2 pcs");
  });
});

describe("the price ladder of an article page", () => {
  it("lists every tier, smallest first, with its label and rule", () => {
    expect(ladderRows([...CLUB_LADDER].reverse(), "GBP")).toEqual([
      { quantity: "10-19", unit: "£29.00", priced: true, label: "Test row, not a factory quote", ruleId: "R-COST-003" },
      { quantity: "20-49", unit: "£25.00", priced: true, label: "Test row, not a factory quote", ruleId: "R-COST-003" },
      { quantity: "50+", unit: "£22.00", priced: true, label: "Test row, not a factory quote", ruleId: "R-COST-003" },
    ]);
  });

  it("shows a tier with no price in that currency as not set, never as nothing or zero", () => {
    expect(ladderRows(CLUB_LADDER, "AUD").map((row) => row.unit)).toEqual([
      "No AUD price is set yet",
      "No AUD price is set yet",
      "No AUD price is set yet",
    ]);
  });

  it("is empty where the article has no tiers", () => {
    expect(ladderRows([], "GBP")).toEqual([]);
  });
});

describe("the market and currency selector", () => {
  it("offers the two markets that sell at launch, with the country rules' own country codes", () => {
    expect(MARKETS).toEqual([
      { id: "uk", label: "UK | GBP", country: "GB", currency: "GBP" },
      { id: "au", label: "AU | AUD", country: "AU", currency: "AUD" },
    ]);
  });

  it("reads the market from the address and falls back to the UK", () => {
    expect(marketFromQuery("au").currency).toBe("AUD");
    expect(marketFromQuery(["au"]).currency).toBe("AUD");
    expect(marketFromQuery("us").currency).toBe("GBP");
    expect(marketFromQuery(undefined).currency).toBe("GBP");
  });

  it("keeps the rest of the address when the market changes", () => {
    expect(marketHref("/catalogue", { tab: "bases", sport: "football" }, MARKETS[1]!)).toBe("/catalogue?tab=bases&sport=football&market=au");
  });
});
