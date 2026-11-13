import { describe, expect, it } from "vitest";
import { parseEvent } from "@/lib/payments/events";
import { readConnectEvent } from "./connect-events";

/** Decision 0156: the Connect events the payouts act on, read leniently but checked where acted on. */

describe("readConnectEvent", () => {
  it("reads what Stripe knows about an account", () => {
    expect(readConnectEvent("account.updated", { id: "acct_1", details_submitted: true, charges_enabled: true, payouts_enabled: false, requirements: { currently_due: ["a", "b"], disabled_reason: "requirements.past_due" } }, "acct_1")).toEqual({
      kind: "account",
      accountId: "acct_1",
      detailsSubmitted: true,
      chargesEnabled: true,
      payoutsEnabled: false,
      requirementsDue: 2,
      disabledReason: "requirements.past_due",
    });
    expect(readConnectEvent("account.updated", { id: "acct_1" }, null)).toMatchObject({ detailsSubmitted: false, payoutsEnabled: false, requirementsDue: 0, disabledReason: null });
  });

  it("reads a seller's bank payout, and leaves the platform's own alone", () => {
    expect(readConnectEvent("payout.paid", { id: "po_1", created: 1_800_000_000 }, "acct_1")).toEqual({ kind: "bank_payout", accountId: "acct_1", payoutId: "po_1", status: "paid", createdAt: new Date(1_800_000_000_000) });
    expect(readConnectEvent("payout.failed", { id: "po_1" }, "acct_1")).toMatchObject({ status: "failed", createdAt: null });
    expect(readConnectEvent("payout.paid", { id: "po_1" }, null)).toEqual({ kind: "none" });
  });

  it("reads a reversed transfer with the payout it made", () => {
    expect(readConnectEvent("transfer.reversed", { id: "tr_1", metadata: { payout_id: "p1" } }, null)).toEqual({ kind: "transfer_reversed", transferId: "tr_1", payoutId: "p1" });
    expect(readConnectEvent("transfer.reversed", { id: "tr_1" }, null)).toMatchObject({ payoutId: null });
  });

  it("is null for a body it cannot read and undefined for another type", () => {
    expect(readConnectEvent("account.updated", {}, null)).toBeNull();
    expect(readConnectEvent("charge.refunded", {}, null)).toBeUndefined();
  });
});

describe("C1's parser", () => {
  it("passes Connect events on whole, with the event's account", () => {
    const parsed = parseEvent(JSON.stringify({ id: "evt_1", type: "payout.paid", account: "acct_1", data: { object: { id: "po_1" } } }));
    expect(parsed).toEqual({ id: "evt_1", type: "payout.paid", event: { kind: "connect", event: { kind: "bank_payout", accountId: "acct_1", payoutId: "po_1", status: "paid", createdAt: null } } });
    expect(parseEvent(JSON.stringify({ id: "evt_2", type: "account.updated", data: { object: { nope: 1 } } }))).toBeNull();
  });
});
