import { describe, expect, it } from "vitest";
import { accrue, formatMoney, rateFromSetting, summarise, type LedgerLine } from "./royalty";

describe("rateFromSetting", () => {
  it("is not set for nothing, for null and for anything that is not a whole number of 0 or more", () => {
    for (const value of [undefined, null, "5", -1, 1.5, Number.NaN, 1_000_001, {}]) expect(rateFromSetting(value), String(value)).toBeNull();
  });

  it("keeps a whole number, and keeps 0", () => {
    expect(rateFromSetting(25)).toBe(25);
    expect(rateFromSetting(0)).toBe(0);
  });
});

describe("accrue", () => {
  it("accrues nothing, and invents no rate, while the rate is not set", () => {
    expect(accrue({ units: 12, rateMinor: null, currency: "AUD" })).toEqual({ rateMinor: null, currency: null, accruedMinor: 0 });
  });

  it("accrues nothing while the order has no currency", () => {
    expect(accrue({ units: 12, rateMinor: 50, currency: null })).toEqual({ rateMinor: null, currency: null, accruedMinor: 0 });
  });

  it("is units times the rate, in the order's currency", () => {
    expect(accrue({ units: 12, rateMinor: 50, currency: "AUD" })).toEqual({ rateMinor: 50, currency: "AUD", accruedMinor: 600 });
  });

  it("a rate of 0 is a rate: it records 0 against the currency", () => {
    expect(accrue({ units: 3, rateMinor: 0, currency: "GBP" })).toEqual({ rateMinor: 0, currency: "GBP", accruedMinor: 0 });
  });
});

const line = (over: Partial<LedgerLine> = {}): LedgerLine => ({ units: 10, rateMinor: 50, currency: "AUD", accruedMinor: 500, ...over });

describe("summarise", () => {
  it("is empty for no lines", () => {
    expect(summarise([])).toEqual({ units: 0, lines: 0, linesWithoutRate: 0, accrued: [] });
  });

  it("adds units, and keeps each currency apart, sorted by currency", () => {
    const out = summarise([line(), line({ units: 4, accruedMinor: 200 }), line({ currency: "GBP", accruedMinor: 100 })]);
    expect(out.units).toBe(24);
    expect(out.lines).toBe(3);
    expect(out.accrued).toEqual([
      { currency: "AUD", minor: 700 },
      { currency: "GBP", minor: 100 },
    ]);
  });

  it("counts units that accrued nothing because no rate was set, and does not add them to any money", () => {
    const out = summarise([line(), line({ rateMinor: null, currency: null, accruedMinor: 0, units: 6 })]);
    expect(out).toMatchObject({ units: 16, linesWithoutRate: 1, accrued: [{ currency: "AUD", minor: 500 }] });
  });
});

describe("formatMoney", () => {
  it("writes the currency code and the amount in its own smallest unit", () => {
    expect(formatMoney(1250, "AUD")).toBe("AUD 12.50");
    expect(formatMoney(0, "GBP")).toBe("GBP 0.00");
    expect(formatMoney(500, "JPY")).toBe("JPY 500");
  });
});
