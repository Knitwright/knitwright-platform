import { describe, expect, it } from "vitest";
import { testWebhookSecret } from "@/lib/payments/select";
import { STRIPE_VERSION } from "@/lib/payments/stripe";
import { connectFrom, isTestAccount, stripeConnect, testAccountEvent, testConnect, testOnboardingPath } from "./connect";

/**
 * Decision 0156: Stripe Connect Express through one adapter, over `fetch`, at C1's pinned API version, each call
 * with an idempotency key so a retried transfer moves money once. No test reaches Stripe: a fake `fetch` answers.
 */

type Call = Readonly<{ url: string; init: RequestInit }>;

const fakeFetch = (answer: Record<string, unknown>, status = 200) => {
  const calls: Call[] = [];
  const fetch = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(answer), { status });
  };
  return { calls, fetch };
};

const form = (call: Call | undefined) => new URLSearchParams(String(call?.init.body));
const header = (call: Call | undefined, name: string) => (call?.init.headers as Record<string, string>)[name];

describe("stripeConnect", () => {
  it("makes an Express account that can take transfers, keyed by the brand", async () => {
    const { calls, fetch } = fakeFetch({ id: "acct_1" });
    const made = await stripeConnect({ secretKey: "sk_test_x", fetch }).createAccount({ brandId: "brand-1", country: "GB", email: "a@b.test" });
    expect(made).toEqual({ accountId: "acct_1" });
    expect(calls[0]?.url).toBe("https://api.stripe.com/v1/accounts");
    expect(Object.fromEntries(form(calls[0]))).toMatchObject({ type: "express", country: "GB", email: "a@b.test", "capabilities[transfers][requested]": "true", "metadata[brand_id]": "brand-1" });
    expect(header(calls[0], "idempotency-key")).toBe("account:brand-1");
    expect(header(calls[0], "stripe-version")).toBe(STRIPE_VERSION);
    expect(header(calls[0], "authorization")).toBe("Bearer sk_test_x");
  });

  it("asks for an onboarding link and a dashboard link", async () => {
    const { calls, fetch } = fakeFetch({ url: "https://connect.stripe.com/x" });
    const connect = stripeConnect({ secretKey: "sk_test_x", fetch });
    await expect(connect.onboardingLink({ accountId: "acct_1", refreshUrl: "https://a/again", returnUrl: "https://a/back" })).resolves.toBe("https://connect.stripe.com/x");
    expect(Object.fromEntries(form(calls[0]))).toEqual({ account: "acct_1", refresh_url: "https://a/again", return_url: "https://a/back", type: "account_onboarding" });
    await expect(connect.dashboardLink("acct_1")).resolves.toBe("https://connect.stripe.com/x");
    expect(calls[1]?.url).toBe("https://api.stripe.com/v1/accounts/acct_1/login_links");
  });

  it("transfers a payout once, keyed by the payout", async () => {
    const { calls, fetch } = fakeFetch({ id: "tr_1" });
    const sent = await stripeConnect({ secretKey: "sk_test_x", fetch }).transfer({ payoutId: "p1", accountId: "acct_1", amountMinor: 61200, currency: "GBP" });
    expect(sent).toEqual({ transferId: "tr_1" });
    expect(Object.fromEntries(form(calls[0]))).toEqual({ amount: "61200", currency: "gbp", destination: "acct_1", transfer_group: "payout_p1", "metadata[payout_id]": "p1" });
    expect(header(calls[0], "idempotency-key")).toBe("transfer:p1");
  });

  it("throws Stripe's refusal, and an answer with no id", async () => {
    const refused = fakeFetch({ error: { type: "invalid_request_error", message: "No such account" } }, 400);
    await expect(stripeConnect({ secretKey: "sk_test_x", fetch: refused.fetch }).transfer({ payoutId: "p", accountId: "a", amountMinor: 1, currency: "GBP" })).rejects.toThrow(/400: invalid_request_error No such account/);
    const empty = fakeFetch({});
    await expect(stripeConnect({ secretKey: "sk_test_x", fetch: empty.fetch }).createAccount({ brandId: "b", country: "GB" })).rejects.toThrow(/no id/);
    const broken = { fetch: async () => new Response("not json", { status: 500 }) };
    await expect(stripeConnect({ secretKey: "sk_test_x", fetch: broken.fetch }).dashboardLink("a")).rejects.toThrow(/500: error/);
  });
});

describe("testConnect", () => {
  it("makes test accounts whose onboarding is a page of this app", async () => {
    const connect = testConnect({ siteUrl: "http://localhost:3000", newId: () => "abc123def456" });
    const { accountId } = await connect.createAccount({ brandId: "b", country: "GB" });
    expect(accountId).toBe("acct_test_kw_abc123def456");
    expect(isTestAccount(accountId)).toBe(true);
    expect(isTestAccount("acct_1")).toBe(false);
    await expect(connect.onboardingLink({ accountId, refreshUrl: "", returnUrl: "" })).resolves.toBe(`http://localhost:3000${testOnboardingPath(accountId)}`);
    await expect(connect.dashboardLink(accountId)).resolves.toContain("/checkout/test/connect/");
    await expect(connect.transfer({ payoutId: "p", accountId, amountMinor: 1, currency: "GBP" })).resolves.toEqual({ transferId: "tr_test_kw_abc123def456" });
  });

  it("writes the account.updated Stripe would send", () => {
    const done = JSON.parse(testAccountEvent("acct_test_kw_x", true, () => "1")) as { type: string; account: string; data: { object: Record<string, unknown> } };
    expect(done).toMatchObject({ type: "account.updated", account: "acct_test_kw_x", data: { object: { payouts_enabled: true, details_submitted: true } } });
    const left = JSON.parse(testAccountEvent("acct_test_kw_x", false)) as { data: { object: { payouts_enabled: boolean } } };
    expect(left.data.object.payouts_enabled).toBe(false);
  });
});

describe("connectFrom", () => {
  const base = { SUPABASE_SECRET_KEY: "server-key", NEXT_PUBLIC_SITE_URL: "http://localhost:3000" };
  const keys = { STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: "whsec_x" };

  it("uses Stripe only with Connect switched on and its own webhook secret", () => {
    expect(connectFrom({ ...base, ...keys })).toBeNull();
    expect(connectFrom({ ...base, ...keys, STRIPE_CONNECT: "on" })).toBeNull();
    const chosen = connectFrom({ ...base, ...keys, STRIPE_CONNECT: "on", STRIPE_CONNECT_WEBHOOK_SECRET: "whsec_connect" });
    expect(chosen?.provider.name).toBe("stripe");
    expect(chosen?.webhookSecret).toBe("whsec_connect");
  });

  it("uses the test onboarding with the test checkout, signed with its derived secret", () => {
    const chosen = connectFrom({ ...base, PAYMENTS_TEST_CHECKOUT: "on" });
    expect(chosen?.provider.name).toBe("test");
    expect(chosen?.webhookSecret).toBe(testWebhookSecret("server-key"));
  });

  it("is off otherwise", () => {
    expect(connectFrom(base)).toBeNull();
    expect(connectFrom({ ...base, STRIPE_SECRET_KEY: "sk_test_x", PAYMENTS_TEST_CHECKOUT: "on" })).toBeNull();
  });
});
