import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./fixtures/memory-store";
import { bpsFromPercent, chargeFor, depositAllowed, depositOf, percentOf, settingsOf } from "./settings";

describe("the payment settings", () => {
  it("read the row, numbers as stored", () => {
    const settings = settingsOf({
      refund_reserve_bps: 1000,
      deposit_bps: 4000,
      deposit_threshold_gbp_minor: "200000" as unknown as number,
      deposit_threshold_aud_minor: null,
      unpriced_orders: "refuse",
      is_placeholder: false,
      label: "Owner's",
    });
    expect(settings).toEqual({
      refundReserveBps: 1000,
      depositBps: 4000,
      depositThresholdMinor: { GBP: 200_000, AUD: null },
      unpricedOrders: "refuse",
      isPlaceholder: false,
      label: "Owner's",
    });
  });

  it("refuse a reserve over 100%", () => {
    expect(() => settingsOf({ ...rowOf(), refund_reserve_bps: 10_001 })).toThrow();
  });
});

const rowOf = () => ({
  refund_reserve_bps: 1000,
  deposit_bps: 4000,
  deposit_threshold_gbp_minor: 200_000,
  deposit_threshold_aud_minor: null,
  unpriced_orders: "invoice" as const,
  is_placeholder: true,
  label: "x",
});

describe("a deposit (F-S7: 40% deposit + 60% before shipping for runs over £2,000)", () => {
  it("is allowed only for a run over the threshold, in a currency that has one", () => {
    expect(depositAllowed("run", 200_001, "GBP", DEFAULT_SETTINGS)).toBe(true);
    expect(depositAllowed("run", 200_000, "GBP", DEFAULT_SETTINGS)).toBe(false);
    expect(depositAllowed("sample", 900_000, "GBP", DEFAULT_SETTINGS)).toBe(false);
    expect(depositAllowed("run", 900_000, "AUD", DEFAULT_SETTINGS)).toBe(false);
  });

  it("is the share rounded up, so the balance is never more than asked", () => {
    expect(depositOf(250_001, DEFAULT_SETTINGS)).toBe(100_001);
    expect(chargeFor("run", 250_001, "GBP", "deposit", DEFAULT_SETTINGS)).toEqual({ schedule: "deposit", amountMinor: 100_001, balanceMinor: 150_000 });
  });

  it("asked for where it is not allowed is charged in full", () => {
    expect(chargeFor("run", 10_000, "GBP", "deposit", DEFAULT_SETTINGS)).toEqual({ schedule: "full", amountMinor: 10_000, balanceMinor: 0 });
    expect(chargeFor("run", 900_000, "GBP", "full", DEFAULT_SETTINGS)).toEqual({ schedule: "full", amountMinor: 900_000, balanceMinor: 0 });
  });
});

describe("a percentage typed by ops", () => {
  it("becomes basis points, or null when it is not a percentage", () => {
    expect(bpsFromPercent("10")).toBe(1000);
    expect(bpsFromPercent(" 12.5 ")).toBe(1250);
    expect(bpsFromPercent("0")).toBe(0);
    expect(bpsFromPercent("")).toBeNull();
    expect(bpsFromPercent("101")).toBeNull();
    expect(bpsFromPercent("-1")).toBeNull();
    expect(bpsFromPercent("ten")).toBeNull();
  });

  it("is written back as a percentage", () => {
    expect(percentOf(1000)).toBe("10%");
    expect(percentOf(1250)).toBe("12.5%");
  });
});
