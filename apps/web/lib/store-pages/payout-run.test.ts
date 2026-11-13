import { describe, expect, it, vi } from "vitest";
import { ProviderError } from "@/lib/payments/provider";
import { signatureHeader } from "@/lib/payments/signature";
import type { PaymentsStore } from "@/lib/payments/store";
import { receiveWebhook } from "@/lib/payments/webhook";
import { testAccountEvent, testConnect } from "./connect";
import { payout } from "./fixtures/store";
import { actOnConnect, describeRun, runPayouts } from "./payout-run";
import type { PayoutRow, PayoutStore } from "./store";

/**
 * Decision 0156: the weekly run sends each prepared payout once, as a transfer keyed by the payout; a refused
 * transfer is marked failed, so its sales are paid again next week; without Connect nothing is prepared. Connect
 * events reach the payouts through C1's one webhook, under either signing secret.
 */

const memory = (pending: readonly PayoutRow[] = []) => {
  const sent: [string, string][] = [];
  const failed: [string | null, string | null, string][] = [];
  const store: PayoutStore = {
    prepare: vi.fn(async () => pending),
    markSent: async (id, transfer) => {
      sent.push([id, transfer]);
    },
    markFailed: async ({ payoutId, transferId }, reason) => {
      failed.push([payoutId, transferId, reason]);
    },
    updateAccount: vi.fn(async (update) => (update.accountId === "acct_ours" ? "brand-1" : null)),
    recordBankPayout: vi.fn(async () => 2),
  };
  return { store, sent, failed };
};

const deps = (store: PayoutStore, connect = testConnect({ siteUrl: "http://localhost", newId: () => "t1" })) => ({ store, connect, now: () => new Date("2026-11-13T09:00:00Z"), log: vi.fn() });

describe("runPayouts", () => {
  it("prepares nothing without Connect", async () => {
    const { store } = memory([payout({ status: "pending" })]);
    expect(await runPayouts({ ...deps(store), connect: null })).toEqual({ prepared: 0, sent: 0, failed: 0, skipped: true });
    expect(store.prepare).not.toHaveBeenCalled();
  });

  it("sends each pending payout as a transfer and records it", async () => {
    const { store, sent } = memory([payout({ id: "p1", status: "pending" }), payout({ id: "p2", status: "pending" })]);
    expect(await runPayouts(deps(store))).toEqual({ prepared: 2, sent: 2, failed: 0, skipped: false });
    expect(sent).toEqual([["p1", "tr_test_kw_t1"], ["p2", "tr_test_kw_t1"]]);
  });

  it("marks a refused transfer failed and carries on", async () => {
    const { store, sent, failed } = memory([payout({ id: "p1", status: "pending" }), payout({ id: "p2", status: "pending" })]);
    const connect = { ...testConnect({ siteUrl: "http://localhost" }), transfer: vi.fn().mockRejectedValueOnce(new ProviderError("no")).mockResolvedValueOnce({ transferId: "tr_2" }) };
    const run = deps(store, connect);
    expect(await runPayouts(run)).toEqual({ prepared: 2, sent: 1, failed: 1, skipped: false });
    expect(failed).toEqual([["p1", null, expect.stringContaining("tried again next week")]]);
    expect(sent).toEqual([["p2", "tr_2"]]);
    expect(run.log).toHaveBeenCalledOnce();
  });

  it("leaves a payout made by another processor alone", async () => {
    const { store, sent } = memory([payout({ status: "pending", provider: "stripe" })]);
    expect(await runPayouts(deps(store))).toMatchObject({ prepared: 1, sent: 0, failed: 0 });
    expect(sent).toEqual([]);
  });

  it("is put into words", () => {
    expect(describeRun({ prepared: 0, sent: 0, failed: 0, skipped: true })).toMatch(/not set up/);
    expect(describeRun({ prepared: 0, sent: 0, failed: 0, skipped: false })).toBe("No seller is owed a payout this week.");
    expect(describeRun({ prepared: 3, sent: 3, failed: 0, skipped: false })).toBe("3 of 3 payouts sent to Stripe.");
    expect(describeRun({ prepared: 3, sent: 2, failed: 1, skipped: false })).toMatch(/1 failed/);
  });
});

describe("actOnConnect", () => {
  it("updates an account, settles bank payouts and fails a reversed transfer", async () => {
    const { store, failed } = memory();
    const account = { kind: "account", accountId: "acct_ours", detailsSubmitted: true, chargesEnabled: true, payoutsEnabled: true, requirementsDue: 0, disabledReason: null } as const;
    expect(await actOnConnect(store, account)).toBe("account updated");
    expect(await actOnConnect(store, { ...account, accountId: "acct_theirs" })).toBe("not ours");
    expect(await actOnConnect(store, { kind: "bank_payout", accountId: "acct_ours", payoutId: "po_1", status: "paid", createdAt: null })).toBe("2 payouts paid");
    expect(await actOnConnect(store, { kind: "transfer_reversed", transferId: "tr_1", payoutId: "p1" })).toBe("transfer reversed");
    expect(failed).toEqual([["p1", "tr_1", expect.stringContaining("reversed")]]);
    expect(await actOnConnect(store, { kind: "none" })).toBe("not a seller's");
  });
});

describe("Connect events through C1's webhook", () => {
  const NOW = 1_800_000_000;
  const payments = {} as PaymentsStore;
  const seen = new Set<string>();
  const paymentsStore = { ...payments, seenEvent: async (id: string) => seen.has(id), recordEvent: async (id: string) => (seen.add(id), true) } as PaymentsStore;

  it("accepts an event signed with the Connect secret and hands it to the payouts", async () => {
    const connect = vi.fn(async () => "account updated");
    const webhook = { secret: "whsec_platform", connectSecret: "whsec_connect", provider: "stripe" as const, nowSeconds: () => NOW, store: paymentsStore, fulfil: vi.fn(), log: vi.fn(), connect };
    const body = testAccountEvent("acct_ours", true, () => "e1");
    expect(await receiveWebhook(webhook, body, signatureHeader("whsec_connect", body, NOW))).toEqual({ status: 200, message: "account updated" });
    expect(connect).toHaveBeenCalledWith(expect.objectContaining({ kind: "account", accountId: "acct_ours", payoutsEnabled: true }));
    const other = testAccountEvent("acct_ours", true, () => "e2");
    expect((await receiveWebhook(webhook, other, signatureHeader("whsec_wrong", other, NOW))).status).toBe(400);
    expect((await receiveWebhook({ ...webhook, connect: undefined }, testAccountEvent("a", true, () => "e3"), signatureHeader("whsec_platform", testAccountEvent("a", true, () => "e3"), NOW))).message).toBe("ignored");
  });

  it("refuses a Connect event whose body it cannot read", async () => {
    const webhook = { secret: "whsec_platform", provider: "stripe" as const, nowSeconds: () => NOW, store: paymentsStore, fulfil: vi.fn(), log: vi.fn() };
    const body = JSON.stringify({ id: "evt_bad", type: "account.updated", data: { object: { nope: true } } });
    expect((await receiveWebhook(webhook, body, signatureHeader("whsec_platform", body, NOW))).status).toBe(400);
  });
});
