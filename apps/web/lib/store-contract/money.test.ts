import { describe, expect, it } from "vitest";
import { appTier } from "@/lib/factory/fixtures/rows";
import { isGap } from "./gap";
import { pricedIn, storePrices } from "./money";
import { bothLadder, gbpOnlyLadder } from "./fixtures/samples";

/**
 * Tier prices. Two rules are worth more than the rest: an Australian figure nobody published is
 * absent rather than converted, and the sentence that says so holds no digit a reader could mistake
 * for an amount.
 */

describe("the ladder as the contract carries it", () => {
  it("carries every band, smallest first, with the row's own label and rule", () => {
    const prices = storePrices([...bothLadder].reverse());
    if (prices.status !== "held") throw new Error("priced");

    expect(prices.tiers.map((tier) => tier.band)).toEqual(["10-19", "20-49", "50+"]);
    expect(prices.tiers[0]?.qtyMin).toBe(10);
    expect(prices.tiers[2]?.qtyMax).toBeNull();
    expect(prices.tiers.every((tier) => tier.ruleId.startsWith("R-"))).toBe(true);
    expect(prices.tiers.every((tier) => tier.label.length > 0)).toBe(true);
  });

  it("names both currencies whether or not either has a figure", () => {
    const prices = storePrices(gbpOnlyLadder);
    if (prices.status !== "held") throw new Error("priced");

    expect(prices.currencies).toEqual(["GBP", "AUD"]);
  });

  it("gives the figure for one piece in integer minor units, never a line total", () => {
    const prices = storePrices(bothLadder);
    if (prices.status !== "held") throw new Error("priced");
    const band = prices.tiers[0]?.prices.GBP;
    if (band?.status !== "held") throw new Error("priced");

    expect(band.unitMinor).toBe(2900);
  });

  it("is one gap for an article no factory has priced, rather than a ladder of gaps", () => {
    const prices = storePrices([]);

    expect(isGap(prices)).toBe(true);
    if (prices.status !== "gap") throw new Error("gap");
    expect(prices.missing).toEqual(["a price ladder for this article"]);
  });
});

describe("the Australian side of a band, which nobody has published", () => {
  const audOf = (ladder = gbpOnlyLadder) => {
    const prices = storePrices(ladder);
    if (prices.status !== "held") throw new Error("priced");
    return prices.tiers[0]!.prices.AUD;
  };

  it("is a gap on every band of the seeded ladder", () => {
    const prices = storePrices(gbpOnlyLadder);
    if (prices.status !== "held") throw new Error("priced");

    expect(prices.tiers.every((tier) => tier.prices.AUD.status === "gap")).toBe(true);
    expect(prices.tiers.every((tier) => tier.prices.GBP.status === "held")).toBe(true);
  });

  it("carries no digit in its words, so nothing in it can be read as an amount", () => {
    const aud = audOf();
    if (aud.status !== "gap") throw new Error("gap");

    expect(aud.because).not.toMatch(/\d/);
    expect(aud.missing.join(" ")).not.toMatch(/\d/);
  });

  it("carries no amount field at all", () => {
    expect(Object.keys(audOf())).toEqual(["status", "missing", "because", "ruleId"]);
  });

  it("never holds the pound figure, converted or otherwise", () => {
    const aud = audOf();

    expect(JSON.stringify(aud)).not.toContain("2900");
    expect(JSON.stringify(aud)).not.toContain("29");
  });

  it("says plainly that the pound figure is not to be converted", () => {
    const aud = audOf();
    if (aud.status !== "gap") throw new Error("gap");

    expect(aud.because).toContain("not to be converted");
  });

  it("holds a figure once one is published, so the shape is ready for it", () => {
    const aud = audOf(bothLadder);
    if (aud.status !== "held") throw new Error("priced");

    expect(aud.unitMinor).toBe(5600);
  });
});

describe("whether a market can be priced at all", () => {
  it("is true only when every band carries a figure in that currency", () => {
    expect(pricedIn(storePrices(bothLadder), "GBP")).toBe(true);
    expect(pricedIn(storePrices(bothLadder), "AUD")).toBe(true);
    expect(pricedIn(storePrices(gbpOnlyLadder), "GBP")).toBe(true);
    expect(pricedIn(storePrices(gbpOnlyLadder), "AUD")).toBe(false);
  });

  it("is false for one band nobody priced, even where the others are priced", () => {
    expect(pricedIn(storePrices([appTier(10, 19, 2900), appTier(20, null, null)]), "GBP")).toBe(false);
  });

  it("is false where there is no ladder", () => {
    expect(pricedIn(storePrices([]), "GBP")).toBe(false);
  });
});
