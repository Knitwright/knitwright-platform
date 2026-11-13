import { describe, expect, it } from "vitest";
import { ProviderError, type CheckoutRequest } from "./provider";
import { paymentsFrom, testWebhookSecret } from "./select";
import { checkoutParams, formEncode, STRIPE_API, STRIPE_VERSION, stripeProvider } from "./stripe";
import { isTestSession, testCheckoutEvent, testCheckoutPath, testProvider } from "./test-provider";

const REQUEST: CheckoutRequest = {
  paymentId: "pay-1",
  brandId: "brand-1",
  mode: "payment",
  currency: "GBP",
  amountMinor: 8700,
  name: "Sample · Home shirt",
  successUrl: "http://localhost:3000/checkout/return?payment=pay-1",
  cancelUrl: "http://localhost:3000/checkout/return?payment=pay-1&cancelled=1",
};

type Call = { url: string; init: RequestInit };

const fakeFetch = (status: number, body: unknown) => {
  const calls: Call[] = [];
  const call = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  };
  return { calls, call };
};

describe("Stripe's form encoding", () => {
  it("encodes nested keys and leaves out what is undefined", () => {
    expect(formEncode({ "a[b]": "x y", n: 3, t: true, gone: undefined })).toBe("a%5Bb%5D=x%20y&n=3&t=true");
  });
});

describe("a Checkout Session", () => {
  it("charges one line, the amount the payment was opened for, and names our payment", () => {
    const params = checkoutParams(REQUEST, false);
    expect(params).toMatchObject({
      mode: "payment",
      client_reference_id: "pay-1",
      "line_items[0][quantity]": 1,
      "line_items[0][price_data][currency]": "gbp",
      "line_items[0][price_data][unit_amount]": 8700,
      "metadata[payment_id]": "pay-1",
      "payment_intent_data[metadata][brand_id]": "brand-1",
    });
    expect(params["line_items[0][price_data][recurring][interval]"]).toBeUndefined();
    expect(params["automatic_tax[enabled]"]).toBeUndefined();
  });

  it("for a plan is a subscription that recurs, with Stripe Tax when asked", () => {
    const params = checkoutParams({ ...REQUEST, mode: "subscription", interval: "year", metadata: { plan_id: "starter" } }, true);
    expect(params).toMatchObject({
      mode: "subscription",
      "line_items[0][price_data][recurring][interval]": "year",
      "subscription_data[metadata][plan_id]": "starter",
      "automatic_tax[enabled]": true,
    });
    expect(checkoutParams({ ...REQUEST, mode: "subscription" }, false)["line_items[0][price_data][recurring][interval]"]).toBe("month");
  });
});

describe("the Stripe provider", () => {
  it("posts the session with the key, a pinned version and our payment as the idempotency key", async () => {
    const fake = fakeFetch(200, { id: "cs_test_1", url: "https://checkout.stripe.com/c/pay/cs_test_1" });
    const provider = stripeProvider({ secretKey: "sk_test_abcdefgh", automaticTax: false, fetch: fake.call });
    expect(await provider.createCheckout(REQUEST)).toEqual({ sessionId: "cs_test_1", url: "https://checkout.stripe.com/c/pay/cs_test_1" });
    const [call] = fake.calls;
    expect(call!.url).toBe(`${STRIPE_API}/checkout/sessions`);
    expect(call!.init.headers).toMatchObject({ authorization: "Bearer sk_test_abcdefgh", "idempotency-key": "checkout:pay-1", "stripe-version": STRIPE_VERSION });
    expect(String(call!.init.body)).toContain("client_reference_id=pay-1");
  });

  it("refunds against the payment intent", async () => {
    const fake = fakeFetch(200, { id: "re_1" });
    const provider = stripeProvider({ secretKey: "sk_test_abcdefgh", automaticTax: false, fetch: fake.call });
    expect(await provider.refund({ paymentId: "pay-1", providerPaymentId: "pi_1", amountMinor: 500, idempotencyKey: "refund:1" })).toEqual({ refundId: "re_1" });
    expect(String(fake.calls[0]!.init.body)).toBe("payment_intent=pi_1&amount=500&metadata%5Bpayment_id%5D=pay-1");
  });

  it("throws on an error answer, or on an answer without the ids", async () => {
    const failing = stripeProvider({ secretKey: "sk_test_abcdefgh", automaticTax: false, fetch: fakeFetch(402, { error: { type: "card_error", message: "Declined" } }).call });
    await expect(failing.createCheckout(REQUEST)).rejects.toThrow(/402: card_error Declined/);
    const empty = stripeProvider({ secretKey: "sk_test_abcdefgh", automaticTax: false, fetch: fakeFetch(200, {}).call });
    await expect(empty.createCheckout(REQUEST)).rejects.toBeInstanceOf(ProviderError);
    await expect(empty.refund({ paymentId: "p", providerPaymentId: "pi", amountMinor: 1, idempotencyKey: "k" })).rejects.toBeInstanceOf(ProviderError);
    const broken = stripeProvider({ secretKey: "sk_test_abcdefgh", automaticTax: false, fetch: async () => new Response("<html>", { status: 500 }) });
    await expect(broken.createCheckout(REQUEST)).rejects.toThrow(/500: error/);
  });
});

describe("the test checkout", () => {
  it("is a page of this app, with sessions that say what they are", async () => {
    const provider = testProvider({ siteUrl: "http://localhost:3100", newId: () => "abc123def456" });
    const session = await provider.createCheckout(REQUEST);
    expect(session).toEqual({ sessionId: "cs_test_kw_abc123def456", url: `http://localhost:3100${testCheckoutPath("cs_test_kw_abc123def456")}` });
    expect(isTestSession(session.sessionId)).toBe(true);
    expect(isTestSession("cs_live_123456789012")).toBe(false);
    expect(await provider.refund({ paymentId: "p", providerPaymentId: "pi", amountMinor: 1, idempotencyKey: "k" })).toEqual({ refundId: "re_test_kw_abc123def456" });
  });

  it("makes the events Stripe would send for paying and for leaving", () => {
    const session = { sessionId: "cs_test_kw_1", paymentId: "pay-1", brandId: "b", mode: "payment" as const, amountMinor: 8700, currency: "GBP" as const, metadata: {} };
    const paid = JSON.parse(testCheckoutEvent(session, "paid", () => "x"));
    expect(paid).toMatchObject({ type: "checkout.session.completed", data: { object: { id: "cs_test_kw_1", payment_status: "paid", amount_total: 8700, currency: "gbp", payment_intent: "pi_test_kw_x", subscription: null } } });
    const left = JSON.parse(testCheckoutEvent(session, "expired", () => "x"));
    expect(left).toMatchObject({ type: "checkout.session.expired", data: { object: { payment_status: "unpaid", payment_intent: null } } });
    const plan = JSON.parse(testCheckoutEvent({ ...session, mode: "subscription", metadata: { plan_id: "starter" } }, "paid", () => "x"));
    expect(plan.data.object).toMatchObject({ subscription: "sub_test_kw_x", customer: "cus_test_kw_x", payment_intent: null, metadata: { plan_id: "starter" } });
  });
});

describe("which processor a deploy uses", () => {
  const base = { SUPABASE_SECRET_KEY: "server-key", NEXT_PUBLIC_SITE_URL: "http://localhost:3000" };

  it("is Stripe when both its key and its webhook secret are set", () => {
    const payments = paymentsFrom({ ...base, STRIPE_SECRET_KEY: "sk_test_abcdefgh", STRIPE_WEBHOOK_SECRET: "whsec_abcdefgh", PAYMENTS_TEST_CHECKOUT: "on" });
    expect(payments?.provider.name).toBe("stripe");
    expect(payments?.webhookSecret).toBe("whsec_abcdefgh");
  });

  it("is nothing when only one of the two is set, even with the test checkout on", () => {
    expect(paymentsFrom({ ...base, STRIPE_SECRET_KEY: "sk_test_abcdefgh", PAYMENTS_TEST_CHECKOUT: "on" })).toBeNull();
    expect(paymentsFrom({ ...base, STRIPE_WEBHOOK_SECRET: "whsec_abcdefgh" })).toBeNull();
  });

  it("is the test checkout when switched on, signed with a secret derived from the server's key", () => {
    const payments = paymentsFrom({ ...base, PAYMENTS_TEST_CHECKOUT: "on" });
    expect(payments?.provider.name).toBe("test");
    expect(payments?.webhookSecret).toBe(testWebhookSecret("server-key"));
    expect(testWebhookSecret("server-key")).not.toBe(testWebhookSecret("another"));
  });

  it("is nothing by default", () => {
    expect(paymentsFrom(base)).toBeNull();
    expect(paymentsFrom({ ...base, PAYMENTS_TEST_CHECKOUT: "off" })).toBeNull();
  });
});
