import { describe, expect, it, vi } from "vitest";
import { PLAN_SETTINGS } from "@/lib/plans/catalogue";
import { AppError } from "@/lib/server/core/errors";
import { CREDIT_PACK_LABEL, creditPacks, planCharge, planCredits, startCreditCheckout, startPlanCheckout } from "./billing";
import { startOrderCheckout, type CheckoutDeps } from "./checkout";
import { intent, priced } from "./fixtures/intents";
import { memoryStore } from "./fixtures/memory-store";
import { signatureHeader } from "./signature";
import { testCheckoutEvent, testProvider } from "./test-provider";
import { receiveWebhook, type WebhookDeps } from "./webhook";

const SECRET = "whsec_test_unit";
const NOW = 1_800_000_000;
const BUYER = { brandId: "brand-1", userId: "user-1" };

function harness() {
  const memory = memoryStore();
  const fulfil = vi.fn(async (paymentId: string) => {
    for (const line of await memory.store.lines(paymentId)) await memory.store.settleLine(line.id, "submitted", crypto.randomUUID(), null, null);
    await memory.store.finish(paymentId);
  });
  const log = vi.fn();
  const deps: WebhookDeps = { secret: SECRET, provider: "test", nowSeconds: () => NOW, store: memory.store, fulfil, log };
  const checkout: CheckoutDeps = { store: memory.store, provider: testProvider({ siteUrl: "http://localhost" }), siteUrl: "http://localhost", fulfil: async () => ({ paymentId: "", status: "missing", lines: [] }) };
  const send = (body: string, at = NOW) => receiveWebhook(deps, body, signatureHeader(SECRET, body, at));
  const paidEvent = async (paymentId: string, outcome: "paid" | "expired" = "paid", over: Partial<{ amountMinor: number }> = {}) => {
    const p = (await memory.store.payment(paymentId))!;
    return testCheckoutEvent({ sessionId: p.sessionId!, paymentId, brandId: p.brandId!, mode: p.purpose === "plan" ? "subscription" : "payment", amountMinor: over.amountMinor ?? p.amountMinor, currency: p.currency, metadata: {} }, outcome);
  };
  return { memory, deps, fulfil, log, checkout, send, paidEvent };
}

const event = (type: string, object: unknown, id = crypto.randomUUID()) => JSON.stringify({ id, type, data: { object } });

describe("the webhook", () => {
  it("refuses an unsigned, forged or stale body, and reads nothing", async () => {
    const h = harness();
    const body = event("checkout.session.expired", { id: "cs" });
    expect(await receiveWebhook(h.deps, body, null)).toEqual({ status: 400, message: "Signature missing." });
    expect((await receiveWebhook(h.deps, body, signatureHeader("whsec_other", body, NOW))).status).toBe(400);
    expect((await h.send(body, NOW - 3600)).status).toBe(400);
    expect((await h.send("not json")).message).toBe("Not an event this endpoint reads.");
  });

  it("sends a paid order to production, once, however often the event comes", async () => {
    const h = harness();
    const reply = await startOrderCheckout(h.checkout, BUYER, { lines: [intent(priced(8700))], currency: "GBP", schedule: "full", description: "x" });
    const body = await h.paidEvent(reply.paymentId);
    expect(await h.send(body)).toEqual({ status: 200, message: "paid" });
    expect(await h.send(body)).toEqual({ status: 200, message: "Already handled." });
    expect(h.fulfil).toHaveBeenCalledOnce();
    expect(h.memory.payments.get(reply.paymentId)?.status).toBe("fulfilled");
  });

  it("refuses an amount that is not the one asked for, and leaves it for a person", async () => {
    const h = harness();
    const reply = await startOrderCheckout(h.checkout, BUYER, { lines: [intent(priced(8700))], currency: "GBP", schedule: "full", description: "x" });
    expect(await h.send(await h.paidEvent(reply.paymentId, "paid", { amountMinor: 1 }))).toEqual({ status: 200, message: "not matched" });
    expect(h.memory.payments.get(reply.paymentId)?.status).toBe("open");
    expect(h.fulfil).not.toHaveBeenCalled();
    expect(h.log).toHaveBeenCalledWith(expect.objectContaining({ level: "error" }));
  });

  it("answers 500 when handling fails, without recording the event, so Stripe sends it again", async () => {
    const h = harness();
    const reply = await startOrderCheckout(h.checkout, BUYER, { lines: [intent(priced(8700))], currency: "GBP", schedule: "full", description: "x" });
    h.fulfil.mockRejectedValueOnce(new Error("down"));
    const body = await h.paidEvent(reply.paymentId);
    expect((await h.send(body)).status).toBe(500);
    expect(await h.send(body)).toEqual({ status: 200, message: "paid" });
    expect(h.fulfil).toHaveBeenCalledTimes(2);
  });

  it("rethrows a database failure while marking paid, as a 500", async () => {
    const h = harness();
    vi.spyOn(h.memory.store, "markPaid").mockRejectedValueOnce(new AppError("internal", "x"));
    expect((await h.send(event("checkout.session.completed", { id: "cs_x", mode: "payment", payment_status: "paid", amount_total: 1, currency: "gbp" }))).status).toBe(500);
  });

  it("ignores a checkout that is not ours, and records an abandoned one", async () => {
    const h = harness();
    expect((await h.send(event("checkout.session.completed", { id: "cs_elsewhere", mode: "payment", payment_status: "paid", amount_total: 1, currency: "gbp" }))).message).toBe("not ours");
    const reply = await startOrderCheckout(h.checkout, BUYER, { lines: [intent(priced(100))], currency: "GBP", schedule: "full", description: "x" });
    expect((await h.send(await h.paidEvent(reply.paymentId, "expired"))).message).toBe("expired");
    expect(h.memory.payments.get(reply.paymentId)?.status).toBe("expired");
    expect((await h.send(event("payment_intent.created", { id: "pi" }))).message).toBe("ignored");
  });

  it("records a refund made in Stripe's dashboard once, by the charge's total refunded", async () => {
    const h = harness();
    const reply = await startOrderCheckout(h.checkout, BUYER, { lines: [intent(priced(8700))], currency: "GBP", schedule: "full", description: "x" });
    await h.send(await h.paidEvent(reply.paymentId));
    const intentId = h.memory.payments.get(reply.paymentId)!.providerPaymentId!;
    expect((await h.send(event("charge.refunded", { id: "ch_1", payment_intent: intentId, amount_refunded: 2000, currency: "gbp" }))).message).toBe("refund recorded");
    expect((await h.send(event("charge.refunded", { id: "ch_1", payment_intent: intentId, amount_refunded: 2000, currency: "gbp" }))).message).toBe("already counted");
    expect((await h.send(event("charge.refunded", { id: "ch_1", payment_intent: "pi_other", amount_refunded: 1, currency: "gbp" }))).message).toBe("not ours");
    expect(h.memory.payments.get(reply.paymentId)?.refundedMinor).toBe(2000);
  });
});

describe("credits and plans", () => {
  it("prices packs at the Starter plan's rate per credit, labelled", () => {
    expect(creditPacks()).toEqual([
      { id: "pack_500", credits: 500, priceMinor: 750 },
      { id: "pack_2000", credits: 2000, priceMinor: 3000 },
      { id: "pack_5000", credits: 5000, priceMinor: 7500 },
    ]);
    expect(creditPacks({ ...PLAN_SETTINGS, plans: [] })).toEqual([]);
    expect(CREDIT_PACK_LABEL).toMatch(/Placeholder/);
  });

  it("charges a plan monthly, or twelve of its annual monthly price yearly, and never Free", () => {
    expect(planCharge("starter", "monthly")).toMatchObject({ interval: "month", amountMinor: 900, credits: 600 });
    expect(planCharge("studio_pro", "annual")).toMatchObject({ interval: "year", amountMinor: 27_600 });
    expect(() => planCharge("free", "monthly")).toThrow(/not one you can buy/);
    expect(planCredits("club_scale")).toBe(8000);
    expect(planCredits("gone")).toBe(0);
  });

  it("gives a pack's credits once when paid", async () => {
    const h = harness();
    await startCreditCheckout(h.checkout, BUYER, "pack_500");
    const [payment] = [...h.memory.payments.values()];
    const body = await h.paidEvent(payment!.id);
    await h.send(body);
    await h.send(body.replace(/evt_test_kw_\w+/, "evt_again"));
    expect(h.memory.credits).toEqual([{ brandId: "brand-1", amount: 500, key: `purchase:${payment!.id}` }]);
    expect(h.memory.payments.get(payment!.id)?.status).toBe("fulfilled");
    await expect(startCreditCheckout(h.checkout, BUYER, "pack_1")).rejects.toThrow(/does not exist/);
  });

  it("records a plan and its first credits when paid, its state as it changes, and its credits each renewal", async () => {
    const h = harness();
    const url = await startPlanCheckout(h.checkout, BUYER, "starter", "monthly");
    expect(url).toMatch(/\/checkout\/test\//);
    const [payment] = [...h.memory.payments.values()];
    await h.send(await h.paidEvent(payment!.id));
    const [sub] = [...h.memory.subscriptions.values()];
    expect(sub).toMatchObject({ brandId: "brand-1", planId: "starter", planInterval: "month", status: "active" });
    await h.send(event("customer.subscription.updated", { id: sub!.subscriptionId, status: "past_due" }));
    expect(h.memory.subscriptions.get(sub!.subscriptionId)?.status).toBe("past_due");
    expect((await h.send(event("invoice.paid", { id: "in_first", billing_reason: "subscription_create", subscription: sub!.subscriptionId }))).message).toBe("first period");
    expect((await h.send(event("invoice.paid", { id: "in_2", billing_reason: "subscription_cycle", subscription: sub!.subscriptionId }))).message).toBe("renewed");
    expect((await h.send(event("invoice.paid", { id: "in_3", billing_reason: "subscription_cycle", subscription: "sub_unknown" }))).message).toBe("not ours");
    expect(h.memory.credits.map((one) => one.key)).toEqual([`plan:${payment!.id}`, "plan:in_2"]);
  });
});
