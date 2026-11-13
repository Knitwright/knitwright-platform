import { randomUUID } from "node:crypto";
import { ProviderError } from "@/lib/payments/provider";
import { testWebhookSecret } from "@/lib/payments/select";
import { formEncode, STRIPE_API, STRIPE_VERSION } from "@/lib/payments/stripe";

/**
 * STRIPE CONNECT EXPRESS (plan v6 C5, decision 0156): the seam that pays sellers. Knitwright is merchant of record
 * (decision 0131): the buyer pays Knitwright through C1's checkout, and the seller's margin is moved to the seller's
 * Express account by a transfer, weekly, after delivery ("separate charges and transfers"). Stripe then pays the
 * seller's bank on the account's own schedule.
 *
 * Two processors, as in C1:
 * - `stripe`: the REST API with `fetch` and C1's form encoding and pinned version. Only with C1's test keys AND
 *   STRIPE_CONNECT=on, because Connect must be switched on in the Stripe account first (an owner action).
 * - `test`: wherever C1's test checkout is on (CI, the browser tests, a local run). Onboarding is a page of this app
 *   (`/checkout/test/connect/<account>`) that signs the `account.updated` Stripe would send and hands it to the one
 *   webhook, so every test walks the real path.
 */

export type ConnectName = "stripe" | "test";

export interface ConnectProvider {
  readonly name: ConnectName;
  /** A new Express account for a brand. */
  createAccount(input: Readonly<{ brandId: string; country: string; email?: string }>): Promise<Readonly<{ accountId: string }>>;
  /** The page where the seller gives Stripe their details. Single use; ask for a new one each time. */
  onboardingLink(input: Readonly<{ accountId: string; refreshUrl: string; returnUrl: string }>): Promise<string>;
  /** The seller's own Express dashboard. */
  dashboardLink(accountId: string): Promise<string>;
  /** Moves a payout's amount to the seller's account. Our payout id is the idempotency key. */
  transfer(input: Readonly<{ payoutId: string; accountId: string; amountMinor: number; currency: string }>): Promise<Readonly<{ transferId: string }>>;
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>;
type Params = Parameters<typeof formEncode>[0];

export function stripeConnect(input: Readonly<{ secretKey: string; fetch?: Fetch }>): ConnectProvider {
  const call = input.fetch ?? ((url, init) => fetch(url, init));
  const post = async (path: string, params: Params, idempotencyKey: string): Promise<Record<string, unknown>> => {
    const response = await call(`${STRIPE_API}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${input.secretKey}`,
        "content-type": "application/x-www-form-urlencoded",
        "idempotency-key": idempotencyKey,
        "stripe-version": STRIPE_VERSION,
      },
      body: formEncode(params),
    });
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      const error = body.error as { message?: string; type?: string } | undefined;
      throw new ProviderError(`Stripe ${path} answered ${response.status}: ${error?.type ?? "error"} ${error?.message ?? ""}`.trim());
    }
    return body;
  };
  const text = (body: Record<string, unknown>, key: string, what: string): string => {
    const value = body[key];
    if (typeof value !== "string") throw new ProviderError(`Stripe made ${what} with no ${key}.`);
    return value;
  };

  return {
    name: "stripe",
    async createAccount({ brandId, country, email }) {
      const body = await post(
        "/accounts",
        { type: "express", country, email, "capabilities[transfers][requested]": true, "metadata[brand_id]": brandId },
        `account:${brandId}`,
      );
      return { accountId: text(body, "id", "an account") };
    },
    async onboardingLink({ accountId, refreshUrl, returnUrl }) {
      const body = await post("/account_links", { account: accountId, refresh_url: refreshUrl, return_url: returnUrl, type: "account_onboarding" }, `link:${randomUUID()}`);
      return text(body, "url", "an onboarding link");
    },
    async dashboardLink(accountId) {
      const body = await post(`/accounts/${encodeURIComponent(accountId)}/login_links`, {}, `login:${randomUUID()}`);
      return text(body, "url", "a dashboard link");
    },
    async transfer({ payoutId, accountId, amountMinor, currency }) {
      const body = await post(
        "/transfers",
        { amount: amountMinor, currency: currency.toLowerCase(), destination: accountId, transfer_group: `payout_${payoutId}`, "metadata[payout_id]": payoutId },
        `transfer:${payoutId}`,
      );
      return { transferId: text(body, "id", "a transfer") };
    },
  };
}

export const TEST_ACCOUNT_PREFIX = "acct_test_kw_";

export const isTestAccount = (accountId: string): boolean => accountId.startsWith(TEST_ACCOUNT_PREFIX) && /^[A-Za-z0-9_]{14,80}$/.test(accountId);

export const testOnboardingPath = (accountId: string): string => `/checkout/test/connect/${accountId}`;

const newHex = (): string => randomUUID().replaceAll("-", "");

export function testConnect(input: Readonly<{ siteUrl: string; newId?: () => string }>): ConnectProvider {
  const newId = input.newId ?? newHex;
  const page = (accountId: string) => new URL(testOnboardingPath(accountId), input.siteUrl).toString();
  return {
    name: "test",
    createAccount: async () => ({ accountId: `${TEST_ACCOUNT_PREFIX}${newId()}` }),
    onboardingLink: async ({ accountId }) => page(accountId),
    dashboardLink: async (accountId) => page(accountId),
    transfer: async () => ({ transferId: `tr_test_kw_${newId()}` }),
  };
}

/** The `account.updated` Stripe would send once the seller has finished (or left) the test onboarding. */
export function testAccountEvent(accountId: string, complete: boolean, newId: () => string = newHex): string {
  return JSON.stringify({
    id: `evt_test_kw_${newId()}`,
    object: "event",
    type: "account.updated",
    account: accountId,
    data: {
      object: {
        id: accountId,
        object: "account",
        details_submitted: complete,
        charges_enabled: complete,
        payouts_enabled: complete,
        requirements: { currently_due: complete ? [] : ["external_account"], disabled_reason: complete ? null : "requirements.past_due" },
      },
    },
  });
}

export type ConnectEnv = Readonly<{
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_CONNECT?: "on" | "off";
  STRIPE_CONNECT_WEBHOOK_SECRET?: string;
  PAYMENTS_TEST_CHECKOUT?: "on" | "off";
  SUPABASE_SECRET_KEY: string;
  NEXT_PUBLIC_SITE_URL: string;
}>;

export type Connect = Readonly<{ provider: ConnectProvider; webhookSecret: string }>;

/**
 * Which Connect processor this deploy uses. Stripe needs C1's keys, STRIPE_CONNECT=on, and its own webhook secret:
 * Stripe signs events from connected accounts (payouts to a seller's bank) at a separate "Connect" endpoint with a
 * secret of its own, which the same route checks. Without that secret a payout could never be seen arriving, so
 * payouts are shown as not set up. The test processor uses the test checkout's derived secret.
 */
export function connectFrom(env: ConnectEnv): Connect | null {
  if (env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET) {
    if (env.STRIPE_CONNECT !== "on" || !env.STRIPE_CONNECT_WEBHOOK_SECRET) return null;
    return { provider: stripeConnect({ secretKey: env.STRIPE_SECRET_KEY }), webhookSecret: env.STRIPE_CONNECT_WEBHOOK_SECRET };
  }
  if (!env.STRIPE_SECRET_KEY && !env.STRIPE_WEBHOOK_SECRET && env.PAYMENTS_TEST_CHECKOUT === "on") {
    return { provider: testConnect({ siteUrl: env.NEXT_PUBLIC_SITE_URL }), webhookSecret: testWebhookSecret(env.SUPABASE_SECRET_KEY) };
  }
  return null;
}
