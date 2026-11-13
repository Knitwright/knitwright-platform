import { describe, expect, it } from "vitest";
import { amountLine, headlineOf, lineSummary, nextPlaceOf } from "./view";
import type { LineRow, PaymentRow } from "./store";

const payment = (over: Partial<PaymentRow> = {}): PaymentRow => ({
  id: "p", brandId: "b", purpose: "order", method: "card", status: "fulfilled", currency: "GBP", orderValueMinor: 8700, amountMinor: 8700,
  schedule: "full", balanceDueMinor: 0, refundedMinor: 0, provider: "test", sessionId: "cs", providerPaymentId: "pi", credits: null,
  planId: null, planInterval: null, description: "Sample", createdBy: "u", createdAt: "", ...over,
});

const line = (over: Partial<LineRow> = {}): LineRow => ({
  id: "l", paymentId: "p", requestKey: "k".repeat(8), door: "make", productId: "x", projectId: "y", kind: "sample", releaseId: "r",
  factoryProfileId: "f", fabricKey: "m", sizes: { M: 1, L: 1 }, flags: [], pieces: 2, valueMinor: 5800, priceLabel: null,
  status: "submitted", orderId: "o", runId: null, message: null, ...over,
});

describe("the amount line", () => {
  it("says what was charged, a deposit with its balance, a plan per period, or that it is invoiced", () => {
    expect(amountLine(payment())).toBe("£87.00");
    expect(amountLine(payment({ schedule: "deposit", amountMinor: 120_000, balanceDueMinor: 180_000 }))).toBe(
      "£1,200.00 deposit now. The balance of £1,800.00 is invoiced by Knitwright before shipping.",
    );
    expect(amountLine(payment({ purpose: "plan", planInterval: "month", amountMinor: 900 }))).toBe("£9.00 a month");
    expect(amountLine(payment({ purpose: "plan", planInterval: "year", amountMinor: 8400 }))).toBe("£84.00 a year");
    expect(amountLine(payment({ method: "invoice" }))).toMatch(/Knitwright invoices this order/);
  });
});

describe("the return page's headline", () => {
  it("says paid, and what happens next, by what was bought", () => {
    expect(headlineOf(payment(), false)).toMatchObject({ title: "Paid", tone: "ok", waiting: false, body: expect.stringContaining("production") });
    expect(headlineOf(payment({ purpose: "credits" }), false).body).toBe("The credits are in your balance.");
    expect(headlineOf(payment({ purpose: "plan" }), false).body).toBe("Your plan is active.");
    expect(headlineOf(payment({ method: "invoice", status: "invoice" }), false).title).toBe("Sent to production");
  });

  it("says which orders were refused and refunded", () => {
    expect(headlineOf(payment(), false, [line(), line({ status: "refused", message: "Blockers." })])).toMatchObject({ title: "Paid, with a refund", tone: "warn", body: expect.stringContaining("Blockers.") });
  });

  it("waits while the processor has not said, and says nothing was charged when left", () => {
    expect(headlineOf(payment({ status: "open" }), false)).toMatchObject({ title: "Waiting for the payment", waiting: true });
    expect(headlineOf(payment({ status: "paid" }), false)).toMatchObject({ title: "Paid", waiting: true });
    expect(headlineOf(payment({ status: "open" }), true)).toMatchObject({ title: "Checkout cancelled", waiting: false });
    expect(headlineOf(payment({ status: "expired" }), true).body).toMatch(/Nothing was charged/);
    expect(headlineOf(payment({ status: "refunded", refundedMinor: 8700 }), false).body).toBe("£87.00 was given back to the card.");
  });
});

describe("an order of a payment", () => {
  it("names its kind, pieces and sizes, and its state with any refusal", () => {
    expect(lineSummary(line())).toEqual({ label: "Sample · 2 pieces · M, L", state: "Sent to production" });
    expect(lineSummary(line({ kind: "run", pieces: 1, sizes: { M: 1 }, status: "refused", message: "Blockers." }))).toEqual({ label: "Run · 1 piece · M", state: "Not sent: Blockers." });
    expect(lineSummary(line({ status: "waiting" })).state).toBe("Waiting for payment");
  });

  it("leads on to the orders, the credits or the plan", () => {
    expect(nextPlaceOf(payment()).href).toBe("/orders");
    expect(nextPlaceOf(payment({ purpose: "credits" })).href).toBe("/credits");
    expect(nextPlaceOf(payment({ purpose: "plan" })).href).toBe("/settings");
  });
});
