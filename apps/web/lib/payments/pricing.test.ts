import { describe, expect, it } from "vitest";
import type { Ladder } from "@/lib/factory/pricing";
import { describePrice, NO_PRICE, piecesOf, runPrice, samplePrice } from "./pricing";

const tier = (qtyMin: number, qtyMax: number | null, gbp: number | null, aud: number | null = null) => ({
  id: crypto.randomUUID(),
  capabilityId: crypto.randomUUID(),
  qtyMin,
  qtyMax,
  cost: null,
  sellGbpMinor: gbp,
  sellAudMinor: aud,
  personalisationCostMinor: null,
  ruleId: "R-COST-003",
  label: "Placeholder club price from the build pack, not a factory quote",
});

const LADDER: Ladder = [tier(50, null, 2200), tier(10, 19, 2900), tier(20, 49, 2500)];

describe("a sample's price", () => {
  it("is the first tier's piece price for every piece, and says why", () => {
    const price = samplePrice(LADDER, 3, "GBP");
    expect(price).toMatchObject({ status: "priced", unitMinor: 2900, valueMinor: 8700 });
    expect(price.status === "priced" && price.label).toMatch(/^Sample priced at the first tier \(10-19 pieces\)/);
    expect(price.status === "priced" && price.label).toContain("Placeholder club price");
  });

  it("is not made up where there is no ladder or no price in the currency", () => {
    expect(samplePrice([], 1, "GBP")).toEqual({ status: "unpriced", reason: NO_PRICE });
    expect(samplePrice(LADDER, 1, "AUD")).toEqual({ status: "unpriced", reason: "No AUD price is set for 10-19 pieces." });
  });
});

describe("a run's price", () => {
  it("is the tier at the quantity, read at the basket's total when given", () => {
    expect(runPrice(LADDER, 60, "GBP")).toMatchObject({ status: "priced", unitMinor: 2200, valueMinor: 132_000 });
    expect(runPrice(LADDER, 12, "GBP", 30)).toMatchObject({ status: "priced", unitMinor: 2500, valueMinor: 30_000 });
  });

  it("is the ladder's own reason where no tier covers it", () => {
    expect(runPrice(LADDER, 5, "GBP")).toEqual({ status: "unpriced", reason: "No tier covers 5 pieces. The smallest tier starts at 10." });
    expect(runPrice([], 5, "GBP")).toEqual({ status: "unpriced", reason: NO_PRICE });
  });
});

describe("the pieces and the words", () => {
  it("adds up the sizes", () => {
    expect(piecesOf({ S: 10, M: 20 })).toBe(30);
  });

  it("writes a price as money, or the reason", () => {
    expect(describePrice({ status: "priced", unitMinor: 1, valueMinor: 8700, label: "" }, "GBP")).toBe("£87.00");
    expect(describePrice({ status: "unpriced", reason: NO_PRICE }, "GBP")).toBe(NO_PRICE);
  });
});
