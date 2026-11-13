import { describe, expect, it } from "vitest";
import { parseEvent } from "./events";

const event = (type: string, object: unknown, id = "evt_1") => JSON.stringify({ id, type, data: { object } });

const SESSION = {
  id: "cs_1",
  mode: "payment",
  payment_status: "paid",
  amount_total: 8700,
  currency: "gbp",
  payment_intent: "pi_1",
  subscription: null,
  customer: null,
  metadata: { payment_id: "pay-1" },
};

describe("reading a Stripe event", () => {
  it("reads a paid checkout, the currency in capitals", () => {
    expect(parseEvent(event("checkout.session.completed", SESSION))).toEqual({
      id: "evt_1",
      type: "checkout.session.completed",
      event: { kind: "checkout_paid", sessionId: "cs_1", mode: "payment", amountMinor: 8700, currency: "GBP", paymentIntent: "pi_1", subscription: null, customer: null, metadata: { payment_id: "pay-1" } },
    });
  });

  it("reads a delayed payment that succeeded the same way, and expanded ids as ids", () => {
    const parsed = parseEvent(event("checkout.session.async_payment_succeeded", { ...SESSION, payment_intent: { id: "pi_2" }, metadata: null }));
    expect(parsed?.event).toMatchObject({ kind: "checkout_paid", paymentIntent: "pi_2", metadata: {} });
  });

  it("ignores a completed checkout that is not paid yet, a setup checkout, or one without an amount", () => {
    expect(parseEvent(event("checkout.session.completed", { ...SESSION, payment_status: "unpaid" }))?.event).toEqual({ kind: "ignored" });
    expect(parseEvent(event("checkout.session.completed", { ...SESSION, mode: "setup" }))?.event).toEqual({ kind: "ignored" });
    expect(parseEvent(event("checkout.session.completed", { ...SESSION, amount_total: null }))?.event).toEqual({ kind: "ignored" });
  });

  it("reads an expired checkout", () => {
    expect(parseEvent(event("checkout.session.expired", { id: "cs_9" }))?.event).toEqual({ kind: "checkout_expired", sessionId: "cs_9" });
  });

  it("reads a refunded charge as its total refunded so far", () => {
    expect(parseEvent(event("charge.refunded", { id: "ch_1", payment_intent: "pi_1", amount_refunded: 500, currency: "gbp" }))?.event).toEqual({
      kind: "charge_refunded",
      chargeId: "ch_1",
      paymentIntent: "pi_1",
      refundedMinor: 500,
    });
    expect(parseEvent(event("charge.refunded", { id: "ch_1", payment_intent: null, amount_refunded: 500, currency: "gbp" }))?.event).toEqual({ kind: "ignored" });
  });

  it("reads a subscription's state, with the period end wherever this API version keeps it", () => {
    expect(parseEvent(event("customer.subscription.updated", { id: "sub_1", status: "past_due", current_period_end: 1_800_000_000 }))?.event).toEqual({
      kind: "subscription_changed",
      subscriptionId: "sub_1",
      status: "past_due",
      periodEnd: new Date(1_800_000_000_000),
    });
    expect(parseEvent(event("customer.subscription.deleted", { id: "sub_1", status: "canceled", items: { data: [{ current_period_end: 1_800_000_000 }] } }))?.event).toMatchObject({
      status: "canceled",
      periodEnd: new Date(1_800_000_000_000),
    });
    expect(parseEvent(event("customer.subscription.updated", { id: "sub_1", status: "active" }))?.event).toMatchObject({ periodEnd: null });
  });

  it("reads a paid invoice of a subscription, old shape or new", () => {
    expect(parseEvent(event("invoice.paid", { id: "in_1", billing_reason: "subscription_cycle", subscription: "sub_1" }))?.event).toEqual({ kind: "invoice_paid", invoiceId: "in_1", subscriptionId: "sub_1", first: false });
    expect(parseEvent(event("invoice.paid", { id: "in_2", billing_reason: "subscription_create", parent: { subscription_details: { subscription: "sub_2" } } }))?.event).toEqual({
      kind: "invoice_paid",
      invoiceId: "in_2",
      subscriptionId: "sub_2",
      first: true,
    });
    expect(parseEvent(event("invoice.paid", { id: "in_3" }))?.event).toEqual({ kind: "ignored" });
  });

  it("acknowledges any other type and ignores it", () => {
    expect(parseEvent(event("payment_intent.created", { id: "pi_1" }))).toEqual({ id: "evt_1", type: "payment_intent.created", event: { kind: "ignored" } });
  });

  it("answers null for a body that is not an event, or an event it cannot read", () => {
    expect(parseEvent("not json")).toBeNull();
    expect(parseEvent(JSON.stringify({ type: "x" }))).toBeNull();
    expect(parseEvent(event("checkout.session.completed", { id: "cs_1" }))).toBeNull();
  });
});
