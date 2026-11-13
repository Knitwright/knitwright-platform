import { describe, expect, it } from "vitest";
import { gbRates, jerseyLadder } from "@/lib/collections/fixtures/plan";
import { channelFeeOf, describeMargin, feeOn, marginFor, retailFromText, saleParts, type ChannelFee } from "./margin";

/**
 * Decision 0156 (spec F-L7): profit per unit at a retail price is retail less base, freight, duty and fees. The
 * base, freight and duty are `landedCost` untouched (30 jerseys: 2500 + 120 + 314 = 2934), and every fee is a row.
 */

const fee: ChannelFee = { channel: "storefront", currency: "GBP", percentBps: 150, fixedMinor: 20, label: "Placeholder", isPlaceholder: true };

const input = (over: Partial<Parameters<typeof marginFor>[0]> = {}) => ({
  ladder: jerseyLadder,
  rates: gbRates,
  currency: "GBP" as const,
  qty: 30,
  retailMinor: 4500,
  fee,
  knitwrightFeeBps: 0,
  ...over,
});

describe("marginFor", () => {
  it("takes base, freight, duty and the channel fee off the retail price", () => {
    const margin = marginFor(input());
    // 1.5% of 4500 is 67.5, rounded once to 68, plus 20 fixed.
    expect(margin).toMatchObject({ status: "priced", baseMinor: 2500, freightMinor: 120, dutyMinor: 314, channelFeeMinor: 88, knitwrightFeeMinor: 0, profitMinor: 4500 - 2934 - 88 });
    expect(margin.status === "priced" && margin.marginBps).toBe(Math.round(((4500 - 2934 - 88) * 10_000) / 4500));
  });

  it("takes the Knitwright fee as a share of retail", () => {
    const margin = marginFor(input({ knitwrightFeeBps: 1000 }));
    expect(margin).toMatchObject({ knitwrightFeeMinor: 450, profitMinor: 4500 - 2934 - 88 - 450 });
  });

  it("shows a loss as a loss, not as nothing", () => {
    const margin = marginFor(input({ retailMinor: 2000 }));
    expect(margin.status === "priced" && margin.profitMinor).toBeLessThan(0);
  });

  it("says the fee is a placeholder, or that none is on file", () => {
    const placeholder = marginFor(input());
    expect(placeholder.status === "priced" && placeholder.notes).toContain("Channel fee: Placeholder.");
    const none = marginFor(input({ fee: null }));
    expect(none).toMatchObject({ channelFeeMinor: 0 });
    expect(none.status === "priced" && none.notes.join(" ")).toMatch(/No channel fee is on file for GBP/);
    const confirmed = marginFor(input({ fee: { ...fee, isPlaceholder: false } }));
    expect(confirmed.status === "priced" && confirmed.notes).toEqual([]);
  });

  it("has no margin at a retail price of nothing, and no price without a retail price or a ladder", () => {
    expect(marginFor(input({ retailMinor: 0 }))).toMatchObject({ status: "priced", marginBps: null });
    expect(marginFor(input({ retailMinor: -1 }))).toEqual({ status: "no-price", reason: "Type a retail price." });
    expect(marginFor(input({ ladder: [] }))).toMatchObject({ status: "no-price" });
  });
});

describe("the parts of a sale", () => {
  it("are the unit figures times the quantity, and add up to the margin", () => {
    const margin = marginFor(input());
    const parts = saleParts(margin, 3);
    expect(parts).toEqual({ retailMinor: 13500, baseMinor: 7500, shippingMinor: 360, dutyMinor: 942, channelFeeMinor: 264, knitwrightFeeMinor: 0 });
    const costs = parts ? parts.baseMinor + parts.shippingMinor + parts.dutyMinor + parts.channelFeeMinor + parts.knitwrightFeeMinor : 0;
    expect(parts && parts.retailMinor - costs).toBe(margin.status === "priced" ? margin.profitMinor * 3 : null);
    expect(saleParts({ status: "no-price", reason: "x" }, 3)).toBeNull();
  });
});

describe("small helpers", () => {
  it("rounds a fee once and adds the fixed part", () => {
    expect(feeOn(4500, 150)).toBe(68);
    expect(channelFeeOf(null, 4500)).toBe(0);
    expect(channelFeeOf(fee, 1000)).toBe(35);
  });

  it("reads a typed price", () => {
    expect(retailFromText("£24.99")).toBe(2499);
    expect(retailFromText("1,200")).toBe(120000);
    expect(retailFromText("abc")).toBeNull();
    expect(retailFromText("")).toBeNull();
  });

  it("says a margin as a whole percentage", () => {
    expect(describeMargin(3412)).toBe("34%");
    expect(describeMargin(null)).toBe("—");
  });
});
