import { describe, expect, it } from "vitest";
import { deliveryFor } from "./delivery";
import { tierDiscounts } from "./discounts";
import { LADDER, tier } from "./fixtures/ladder";
import { money, orderNumber, shortDate, sizesText } from "./format";
import { customerStatus, filterOf, FILTERS, matchesFilter, NO_MILESTONES, reachedStep, STATUS_LABELS, TRACK_STEPS } from "./status";
import { NOT_ON_FILE, orderSummary } from "./summary";

describe("the customer's status", () => {
  it("maps each ops state, with Placed standing in for Paid until checkout exists", () => {
    expect(customerStatus("submitted", NO_MILESTONES)).toBe("placed");
    expect(customerStatus("held", NO_MILESTONES)).toBe("on_hold");
    expect(customerStatus("batched", NO_MILESTONES)).toBe("in_batch");
    expect(customerStatus("received", NO_MILESTONES)).toBe("at_factory");
    expect(customerStatus("in_production", NO_MILESTONES)).toBe("in_production");
    expect(customerStatus("ready", NO_MILESTONES)).toBe("awaiting_qc");
    expect(TRACK_STEPS[0]).toBe("placed");
  });

  it("lets a passing inspection and a parcel move the order on", () => {
    expect(customerStatus("ready", { qcPassedAt: "2026-11-01T10:00:00Z", shippedOn: null })).toBe("qc_passed");
    expect(customerStatus("ready", { qcPassedAt: "2026-11-01T10:00:00Z", shippedOn: "2026-11-02" })).toBe("shipped");
  });

  it("places each status on the timeline", () => {
    expect(reachedStep("on_hold")).toBe(0);
    expect(reachedStep("awaiting_qc")).toBe(3);
    expect(reachedStep("shipped")).toBe(5);
    expect(STATUS_LABELS.qc_passed).toBe("QC passed");
  });

  it("filters by chip, and the states that do not exist yet match nothing", () => {
    expect(matchesFilter("all", "placed")).toBe(true);
    expect(matchesFilter("on_hold", "on_hold")).toBe(true);
    expect(matchesFilter("in_production", "at_factory")).toBe(true);
    expect(matchesFilter("in_production", "placed")).toBe(false);
    expect(matchesFilter("shipped", "shipped")).toBe(true);
    expect(matchesFilter("delivered", "shipped")).toBe(false);
    expect(matchesFilter("cancelled", "shipped")).toBe(false);
    expect(matchesFilter("awaiting_approval", "placed")).toBe(false);
    expect(filterOf("shipped")).toBe("shipped");
    expect(filterOf("nonsense")).toBe("all");
    expect(FILTERS.map((f) => f.label)).toContain("Cancelled");
  });
});

describe("the words and figures", () => {
  it("writes the number, the date, money and sizes", () => {
    expect(orderNumber("3f9a21c0-1111-4000-8000-000000000000")).toBe("KW-3F9A21C0");
    expect(shortDate("2026-12-04")).toBe("4 Dec");
    expect(shortDate("2026-11-02T10:00:00Z")).toBe("2 Nov");
    expect(money(62500, "GBP")).toBe("£625.00");
    expect(money(100, "XX")).toBe("XX 1.00");
    expect(sizesText({ L: 8, M: 9, S: 4 })).toBe("L8 · M9 · S4");
  });
});

describe("the discount banner", () => {
  it("reads each tier's saving against the smallest tier", () => {
    expect(tierDiscounts([LADDER], "GBP")).toEqual([
      { minQty: 20, percent: 10 },
      { minQty: 50, percent: 20 },
    ]);
  });

  it("shows the smallest saving where articles differ, and nothing for a market with no prices", () => {
    const other = [tier(1, 19, 2000, null, "00000000-0000-4000-8000-0000000000c2"), tier(20, null, 1900, null, "00000000-0000-4000-8000-0000000000c2")];
    expect(tierDiscounts([LADDER, other], "GBP")[0]).toEqual({ minQty: 20, percent: 5 });
    expect(tierDiscounts([LADDER], "AUD")).toEqual([]);
    expect(tierDiscounts([[tier(1, null, 0)]], "GBP")).toEqual([]);
  });
});

describe("the delivery date", () => {
  it("adds QC working days and freight days to the factory's ready date", () => {
    // Friday 4 Dec 2026 + 2 working days is Tuesday 8 Dec, + 5 days is Sunday 13 Dec.
    expect(deliveryFor({ readyOn: "2026-12-04", qcDays: 2, freightDays: 5 })).toEqual({ status: "set", on: "2026-12-13" });
  });

  it("names what is missing instead of guessing", () => {
    const answer = deliveryFor({ readyOn: null, qcDays: null, freightDays: 5 });
    expect(answer).toMatchObject({ status: "not-set", missing: ["the factory's lead time", "the days for QC"] });
    expect(answer.status === "not-set" && answer.text).toBe("No delivery date yet. Not set: the factory's lead time and the days for QC.");
  });
});

describe("the order summary", () => {
  it("prices production at the smallest tier and shows the team discount", () => {
    const summary = orderSummary({ kind: "run", pieces: 25, currency: "GBP", ladder: LADDER, value: null });
    expect(summary.lines).toEqual([
      { label: "Production (25 × £30.00)", value: "£750.00" },
      { label: "Team discount (20+ pieces)", value: "−£75.00", credit: true },
      { label: "Shipping", value: NOT_ON_FILE },
      { label: "Sampling", value: "None" },
    ]);
    expect(summary.total).toBeNull();
  });

  it("takes the total the order came with, and says when an article has no price", () => {
    const summary = orderSummary({ kind: "sample", pieces: 2, currency: "GBP", ladder: [], value: { minor: 4600, currency: "GBP" } });
    expect(summary.lines[0]).toEqual({ label: "Production", value: "No price ladder for this article." });
    expect(summary.lines.at(-1)).toEqual({ label: "Sampling", value: NOT_ON_FILE });
    expect(summary.total).toBe("£46.00");
  });

  it("shows no discount at the smallest tier, and a ladder with no price in the market as not on file", () => {
    expect(orderSummary({ kind: "run", pieces: 5, currency: "GBP", ladder: LADDER, value: null }).lines).toHaveLength(3);
    expect(orderSummary({ kind: "run", pieces: 5, currency: "AUD", ladder: LADDER, value: null }).lines[0]).toEqual({ label: "Production", value: "No AUD price is set for 1-19 pieces." });
  });
});

describe("the edges", () => {
  it("names each missing part on its own, and reads Australian prices", () => {
    expect(deliveryFor({ readyOn: "2026-12-04", qcDays: 2, freightDays: null })).toMatchObject({ missing: ["the freight days"] });
    expect(deliveryFor({ readyOn: "2026-12-04", qcDays: null, freightDays: 1 })).toMatchObject({ missing: ["the days for QC"] });
    expect(tierDiscounts([[tier(1, 19, null, 4000), tier(20, null, null, 3000)]], "AUD")).toEqual([{ minQty: 20, percent: 25 }]);
    expect(tierDiscounts([[tier(1, 19, 3000), tier(20, null, null)]], "GBP")).toEqual([]);
  });
});
