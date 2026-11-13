import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { CHECKOUT_NOT_SET_UP, startOrderCheckout, type CheckoutDeps } from "./checkout";
import { intent, priced, unpriced } from "./fixtures/intents";
import { DEFAULT_SETTINGS, memoryStore } from "./fixtures/memory-store";
import { fulfilPayment, refundShare, refusalsOf, type FulfilDeps } from "./fulfil";
import { testProvider } from "./test-provider";
import { refundable, refundPayment, REFUND_NOT_SET_UP } from "./refunds";
import type { PaymentRow } from "./store";

const BUYER = { brandId: "brand-1", userId: "user-1", email: "kit@example.com" };
const SITE = "http://localhost:3100";

function harness(options: Readonly<{ refuse?: (requestKey: string) => AppError | Error | null; settings?: typeof DEFAULT_SETTINGS; noProvider?: boolean }> = {}) {
  const memory = memoryStore(options.settings);
  const provider = testProvider({ siteUrl: SITE });
  const sent: string[] = [];
  const creditsBack = vi.fn(async () => undefined);
  const log = vi.fn();
  const fulfilDeps: FulfilDeps = {
    store: memory.store,
    submit: async (line) => {
      const refusal = options.refuse?.(line.requestKey) ?? null;
      if (refusal) throw refusal;
      sent.push(line.requestKey);
      return { orderId: crypto.randomUUID(), runId: crypto.randomUUID(), status: "submitted" };
    },
    creditsBack,
    refund: async (payment, amount, reason) => {
      await refundPayment({ store: memory.store, provider }, payment, amount, reason, null);
    },
    log,
  };
  const deps: CheckoutDeps = { store: memory.store, provider: options.noProvider ? null : provider, siteUrl: SITE, fulfil: (id) => fulfilPayment(fulfilDeps, id) };
  return { memory, deps, fulfilDeps, sent, creditsBack, log };
}

const pay = async (h: ReturnType<typeof harness>, paymentId: string, intentId = "pi_1") => {
  const payment = (await h.memory.store.payment(paymentId))!;
  await h.memory.store.markPaid(payment.sessionId!, intentId, payment.amountMinor, payment.currency);
};

describe("checking out an order with a price", () => {
  it("opens a payment holding each order and sends the person to the checkout, sending nothing yet", async () => {
    const h = harness();
    const reply = await startOrderCheckout(h.deps, BUYER, { lines: [intent(priced(8700))], currency: "GBP", schedule: "full", description: "Sample of Home shirt" });
    expect(reply.kind).toBe("checkout");
    if (reply.kind !== "checkout") return;
    expect(reply.url).toMatch(new RegExp(`^${SITE}/checkout/test/cs_test_kw_`));
    expect(h.memory.payments.get(reply.paymentId)).toMatchObject({ status: "open", method: "card", amountMinor: 8700, orderValueMinor: 8700, provider: "test" });
    expect(h.sent).toEqual([]);
  });

  it("charges a deposit on a run over the threshold when asked, and the rest is the balance", async () => {
    const h = harness();
    const reply = await startOrderCheckout(h.deps, BUYER, { lines: [intent(priced(300_000), { kind: "run" })], currency: "GBP", schedule: "deposit", description: "Run" });
    if (reply.kind !== "checkout") throw new Error("expected a checkout");
    expect(h.memory.payments.get(reply.paymentId)).toMatchObject({ schedule: "deposit", amountMinor: 120_000, balanceDueMinor: 180_000 });
  });

  it("is refused in plain words where no processor is set up", async () => {
    const h = harness({ noProvider: true });
    await expect(startOrderCheckout(h.deps, BUYER, { lines: [intent(priced(1))], currency: "GBP", schedule: "full", description: "x" })).rejects.toThrow(CHECKOUT_NOT_SET_UP);
  });

  it("refuses an empty order and a second checkout for the same order", async () => {
    const h = harness();
    await expect(startOrderCheckout(h.deps, BUYER, { lines: [], currency: "GBP", schedule: "full", description: "x" })).rejects.toThrow(/Choose something/);
    const line = intent(priced(100));
    await startOrderCheckout(h.deps, BUYER, { lines: [line], currency: "GBP", schedule: "full", description: "x" });
    await expect(startOrderCheckout(h.deps, BUYER, { lines: [line], currency: "GBP", schedule: "full", description: "x" })).rejects.toThrow(/already has a checkout/);
  });
});

describe("an order with no price on file", () => {
  it("is an invoice by default, sent to production now", async () => {
    const h = harness();
    const line = intent(unpriced);
    const reply = await startOrderCheckout(h.deps, BUYER, { lines: [line], currency: "GBP", schedule: "full", description: "x" });
    expect(reply.kind).toBe("sent");
    expect(h.sent).toEqual([line.requestKey]);
    expect(h.memory.payments.get(reply.paymentId)).toMatchObject({ method: "invoice", status: "fulfilled", amountMinor: 0, orderValueMinor: null });
    expect(h.creditsBack).toHaveBeenCalledOnce();
  });

  it("is refused with the ladder's reason when the setting says refuse", async () => {
    const h = harness({ settings: { ...DEFAULT_SETTINGS, unpricedOrders: "refuse" } });
    await expect(startOrderCheckout(h.deps, BUYER, { lines: [intent(unpriced)], currency: "GBP", schedule: "full", description: "x" })).rejects.toThrow(
      /No price is on file for this article yet\. Knitwright has to set a price/,
    );
  });

  it("answers with the database's refusal when every order is refused", async () => {
    const h = harness({ refuse: () => new AppError("conflict", "This design has blockers.") });
    await expect(startOrderCheckout(h.deps, BUYER, { lines: [intent(unpriced)], currency: "GBP", schedule: "full", description: "x" })).rejects.toThrow("This design has blockers.");
  });
});

describe("fulfilment once paid", () => {
  it("sends every order, gives the design's credits back, and marks the payment fulfilled, once", async () => {
    const h = harness();
    const lines = [intent(priced(5000)), intent(priced(3700))];
    const reply = await startOrderCheckout(h.deps, BUYER, { lines, currency: "GBP", schedule: "full", description: "x" });
    await pay(h, reply.paymentId);
    const first = await fulfilPayment(h.fulfilDeps, reply.paymentId);
    expect(first.status).toBe("fulfilled");
    expect(first.lines.map((line) => line.status)).toEqual(["submitted", "submitted"]);
    expect(h.sent).toEqual(lines.map((line) => line.requestKey));
    const again = await fulfilPayment(h.fulfilDeps, reply.paymentId);
    expect(again.lines.map((line) => line.status)).toEqual(["submitted", "submitted"]);
    expect(h.sent).toHaveLength(2);
    expect(h.creditsBack).toHaveBeenCalledTimes(2);
  });

  it("does nothing for a payment that is not paid, not an order, or not there", async () => {
    const h = harness();
    const reply = await startOrderCheckout(h.deps, BUYER, { lines: [intent(priced(100))], currency: "GBP", schedule: "full", description: "x" });
    expect(await fulfilPayment(h.fulfilDeps, reply.paymentId)).toEqual({ paymentId: reply.paymentId, status: "open", lines: [] });
    expect(await fulfilPayment(h.fulfilDeps, "nope")).toEqual({ paymentId: "nope", status: "missing", lines: [] });
    expect(h.sent).toEqual([]);
  });

  it("refunds a refused order's share at once, and keeps the others", async () => {
    const refusedLine = intent(priced(3700));
    const h = harness({ refuse: (key) => (key === refusedLine.requestKey ? new AppError("conflict", "This design has blockers.") : null) });
    const reply = await startOrderCheckout(h.deps, BUYER, { lines: [intent(priced(5000)), refusedLine], currency: "GBP", schedule: "full", description: "x" });
    await pay(h, reply.paymentId);
    const result = await fulfilPayment(h.fulfilDeps, reply.paymentId);
    expect(result.lines.map((line) => line.status)).toEqual(["submitted", "refused"]);
    expect(refusalsOf(result)).toBe("This design has blockers.");
    expect(h.memory.refunds).toEqual([expect.objectContaining({ amountMinor: 3700, reason: "Not sent to production: This design has blockers." })]);
    expect(h.memory.payments.get(reply.paymentId)).toMatchObject({ refundedMinor: 3700, status: "fulfilled" });
  });

  it("lets an unexpected failure through, so the webhook answers 500 and Stripe tries again", async () => {
    const h = harness({ refuse: () => new Error("database down") });
    const reply = await startOrderCheckout(h.deps, BUYER, { lines: [intent(priced(100))], currency: "GBP", schedule: "full", description: "x" });
    await pay(h, reply.paymentId);
    await expect(fulfilPayment(h.fulfilDeps, reply.paymentId)).rejects.toThrow("database down");
    expect(h.memory.lines[0]!.status).toBe("waiting");
  });

  it("keeps the order when the credits cannot be given back, and logs it", async () => {
    const h = harness();
    h.creditsBack.mockRejectedValueOnce(new Error("ledger"));
    const reply = await startOrderCheckout(h.deps, BUYER, { lines: [intent(priced(100))], currency: "GBP", schedule: "full", description: "x" });
    await pay(h, reply.paymentId);
    expect((await fulfilPayment(h.fulfilDeps, reply.paymentId)).lines[0]!.status).toBe("submitted");
    expect(h.log).toHaveBeenCalledWith(expect.objectContaining({ level: "error" }));
  });
});

const row = (over: Partial<PaymentRow>): PaymentRow => ({
  id: "p", brandId: "b", purpose: "order", method: "card", status: "paid", currency: "GBP", orderValueMinor: 10_000, amountMinor: 10_000,
  schedule: "full", balanceDueMinor: 0, refundedMinor: 0, provider: "test", sessionId: "cs", providerPaymentId: "pi", credits: null,
  planId: null, planInterval: null, description: "x", createdBy: "u", createdAt: "", ...over,
});

describe("a refused line's share", () => {
  const line = { ...intent(priced(2500)), id: "l", paymentId: "p", status: "refused" as const, orderId: null, runId: null, message: null, valueMinor: 2500, priceLabel: null };

  it("is its value when paid in full, its part of a deposit otherwise, and never more than is left", () => {
    expect(refundShare(row({}), line)).toBe(2500);
    expect(refundShare(row({ schedule: "deposit", amountMinor: 4000, balanceDueMinor: 6000 }), line)).toBe(1000);
    expect(refundShare(row({ refundedMinor: 9000 }), line)).toBe(1000);
    expect(refundShare(row({ method: "invoice" }), line)).toBe(0);
    expect(refundShare(row({}), { ...line, valueMinor: null })).toBe(0);
  });
});

describe("a refund from ops", () => {
  const store = memoryStore().store;

  it("is never more than what is left, never without a charge, never without a processor", async () => {
    const provider = testProvider({ siteUrl: SITE });
    expect(refundable(row({ refundedMinor: 400 }))).toBe(9600);
    expect(refundable(row({ status: "open" }))).toBe(0);
    await expect(refundPayment({ store, provider }, row({}), 10_001, "x", null)).rejects.toThrow(/never more/);
    await expect(refundPayment({ store, provider }, row({}), 0, "x", null)).rejects.toThrow(/more than nothing/);
    await expect(refundPayment({ store, provider }, row({ providerPaymentId: null }), 1, "x", null)).rejects.toThrow(/no card charge/);
    await expect(refundPayment({ store, provider: null }, row({}), 1, "x", null)).rejects.toThrow(REFUND_NOT_SET_UP);
    await expect(refundPayment({ store, provider }, row({ provider: "stripe" }), 1, "x", null)).rejects.toThrow(REFUND_NOT_SET_UP);
  });
});
