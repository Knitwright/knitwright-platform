import { describe, expect, it, vi } from "vitest";
import { createCreditsService, type CreditsDb } from "./service";
import { CREDIT_SETTINGS } from "./settings";

const db = (answers: Record<string, unknown>, rows: unknown[] = []): CreditsDb & { calls: [string, Record<string, unknown>][] } => {
  const calls: [string, Record<string, unknown>][] = [];
  return {
    calls,
    rpc: async (fn, args) => {
      calls.push([fn, args]);
      return fn in answers ? { data: answers[fn], error: null } : { data: null, error: { message: "boom" } };
    },
    readLedger: async () => rows,
  };
};

const BRAND = "00000000-0000-4000-8000-000000000001";
const USER = "00000000-0000-4000-8000-000000000002";

describe("spendCredits", () => {
  it("asks the database to spend and reports what was charged", async () => {
    const d = db({ credit_spend: { ok: true, charged: true, price: 2, balance: 8, entry_id: "e1" } });
    const result = await createCreditsService(d).spendCredits({
      brandId: BRAND, userId: USER, kind: "techpack_pdf", designVersionHash: "abc",
    });
    expect(result).toEqual({ ok: true, charged: true, price: 2, balance: 8, entryId: "e1" });
    expect(d.calls[0]).toEqual([
      "credit_spend",
      { p_brand_id: BRAND, p_user_id: USER, p_kind: "techpack_pdf", p_version_hash: "abc", p_usage_event_id: null },
    ]);
  });

  it("passes on the usage event of the paid call it pays for", async () => {
    const d = db({ credit_spend: { ok: true, charged: false, price: 1, balance: 1, entry_id: null } });
    await createCreditsService(d).spendCredits({
      brandId: BRAND, userId: USER, kind: "pattern_file", designVersionHash: "abc", usageEventId: "u1",
    });
    expect(d.calls[0]?.[1]).toMatchObject({ p_usage_event_id: "u1" });
  });

  it("says when the balance is short", async () => {
    const d = db({ credit_spend: { ok: false, reason: "insufficient", price: 3, balance: 1 } });
    const result = await createCreditsService(d).spendCredits({
      brandId: BRAND, userId: USER, kind: "marketing_media", designVersionHash: "abc",
    });
    expect(result).toEqual({ ok: false, reason: "insufficient", price: 3, balance: 1 });
  });

  it("throws when the database fails or answers in an odd shape", async () => {
    const input = { brandId: BRAND, userId: USER, kind: "pattern_file", designVersionHash: "abc" } as const;
    await expect(createCreditsService(db({})).spendCredits(input)).rejects.toThrow(/credits/i);
    await expect(createCreditsService(db({ credit_spend: { nope: 1 } })).spendCredits(input)).rejects.toThrow(/credits/i);
  });

  it("refuses an empty design version before calling the database", async () => {
    const d = db({});
    await expect(
      createCreditsService(d).spendCredits({ brandId: BRAND, userId: USER, kind: "pattern_file", designVersionHash: " " }),
    ).rejects.toThrow(/design version/i);
    expect(d.calls).toHaveLength(0);
  });
});

describe("refundForOrder", () => {
  it("refunds every spend on the version and returns the amount", async () => {
    const d = db({ credit_refund_for_order: { refunded: 3, balance: 9 } });
    const result = await createCreditsService(d).refundForOrder({ brandId: BRAND, designVersionHash: "abc" });
    expect(result).toEqual({ refunded: 3, balance: 9 });
    expect(d.calls[0]).toEqual(["credit_refund_for_order", { p_brand_id: BRAND, p_version_hash: "abc" }]);
  });
});

describe("ensureMonthlyAllowance", () => {
  it("grants the month's free credits through the shared allowance month", async () => {
    const d = db({ credit_ensure_allowance: { applied: true, balance: 10 } });
    const result = await createCreditsService(d).ensureMonthlyAllowance(BRAND, new Date("2026-10-24T12:00:00Z"));
    expect(result).toEqual({ applied: true, balance: 10 });
    expect(d.calls[0]).toEqual([
      "credit_ensure_allowance",
      { p_brand_id: BRAND, p_month: "2026-10-01", p_amount: CREDIT_SETTINGS.monthlyAllowance },
    ]);
  });
});

describe("syncCreditPrices", () => {
  it("writes the settings file's prices and marks them as placeholders", async () => {
    const d = db({ credit_set_prices: null });
    await createCreditsService(d).syncCreditPrices();
    expect(d.calls[0]).toEqual([
      "credit_set_prices",
      { p_prices: CREDIT_SETTINGS.prices, p_placeholder: CREDIT_SETTINGS.isPlaceholder },
    ]);
  });
});

describe("summary", () => {
  it("returns the balance and the history, newest first, with the placeholder flag", async () => {
    const rows = [
      { id: "a", kind: "grant", amount: 10, output_kind: null, design_version_hash: null, refund_of: null, idempotency_key: "k1", note: "Monthly free credits", created_at: "2026-10-01T00:00:00Z" },
      { id: "b", kind: "spend", amount: -1, output_kind: "pattern_file", design_version_hash: "h", refund_of: null, idempotency_key: "k2", note: "", created_at: "2026-10-02T00:00:00Z" },
    ];
    const d = db({ credit_balance: 9 }, rows);
    const summary = await createCreditsService(d).summary(BRAND);
    expect(summary.balance).toBe(9);
    expect(summary.history.map((h) => [h.id, h.balanceAfter])).toEqual([["b", 9], ["a", 10]]);
    expect(summary.prices).toEqual(CREDIT_SETTINGS.prices);
    expect(summary.isPlaceholder).toBe(true);
  });

  it("starts the running balance from the database's balance when older lines are not shown", async () => {
    const rows = [
      { id: "b", kind: "spend", amount: -1, output_kind: "pattern_file", design_version_hash: "h", refund_of: null, idempotency_key: "k2", note: "", created_at: "2026-10-02T00:00:00Z" },
    ];
    const summary = await createCreditsService(db({ credit_balance: 40 }, rows)).summary(BRAND);
    expect(summary.balance).toBe(40);
    expect(summary.history.map((h) => h.balanceAfter)).toEqual([40]);
  });

  it("throws on a ledger row it cannot read", async () => {
    await expect(createCreditsService(db({ credit_balance: 0 }, [{ id: 1 }])).summary(BRAND)).rejects.toThrow(/credits/i);
  });
});

it("does not call anything at import", () => {
  const spy = vi.fn();
  createCreditsService({ rpc: spy, readLedger: spy });
  expect(spy).not.toHaveBeenCalled();
});

describe("settings set in the console (lib/settings)", () => {
  const owned = { isPlaceholder: false, prices: { marketing_media: 5, techpack_pdf: 2, pattern_file: 3, production_package: 4 }, monthlyAllowance: 12 };

  it("gives the allowance, syncs the prices and summarises with the stored numbers", async () => {
    const d = { ...db({ credit_ensure_allowance: { applied: true, balance: 12 }, credit_set_prices: null, credit_balance: 12 }), readSettings: async () => owned };
    const service = createCreditsService(d);
    await service.ensureMonthlyAllowance(BRAND, new Date("2026-10-27T00:00:00Z"));
    await service.syncCreditPrices();
    const summary = await service.summary(BRAND);
    expect(d.calls[0]?.[1]).toMatchObject({ p_amount: 12 });
    expect(d.calls[1]).toEqual(["credit_set_prices", { p_prices: owned.prices, p_placeholder: false }]);
    expect(summary).toMatchObject({ prices: owned.prices, isPlaceholder: false, monthlyAllowance: 12 });
  });

  it("uses the placeholders when no settings reader is given", async () => {
    const d = db({ credit_ensure_allowance: { applied: true, balance: 10 } });
    await createCreditsService(d).ensureMonthlyAllowance(BRAND, new Date("2026-10-27T00:00:00Z"));
    expect(d.calls[0]?.[1]).toMatchObject({ p_amount: CREDIT_SETTINGS.monthlyAllowance });
  });
});
