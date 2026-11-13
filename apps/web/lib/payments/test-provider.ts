import { randomUUID } from "node:crypto";
import type { CheckoutSession, PaymentProvider } from "./provider";
import type { PayCurrency } from "./settings";

/**
 * The TEST CHECKOUT (plan v6 C1, decision 0152): the processor wherever no Stripe key is set and
 * PAYMENTS_TEST_CHECKOUT is on — the browser tests, CI and a local run. It never reaches the network.
 *
 * Its checkout is a page of this app (`/checkout/test/<session>`) with "Pay with a test card" and "Cancel". Each
 * button makes the event Stripe would send (`checkout.session.completed` or `.expired`), signs it with the test
 * webhook secret and hands it to the same `receiveWebhook` the Stripe endpoint uses, so the test checkout proves
 * the real path: signature, idempotency, amount check, fulfilment.
 *
 * The environment check refuses PAYMENTS_TEST_CHECKOUT wherever real people sign in.
 */

export const TEST_SESSION_PREFIX = "cs_test_kw_";

export const isTestSession = (sessionId: string): boolean => sessionId.startsWith(TEST_SESSION_PREFIX) && /^[A-Za-z0-9_-]{12,80}$/.test(sessionId);

export const testCheckoutPath = (sessionId: string): string => `/checkout/test/${sessionId}`;

export function testProvider(input: Readonly<{ siteUrl: string; newId?: () => string }>): PaymentProvider {
  const newId = input.newId ?? (() => randomUUID().replaceAll("-", ""));
  return {
    name: "test",
    async createCheckout(): Promise<CheckoutSession> {
      const sessionId = `${TEST_SESSION_PREFIX}${newId()}`;
      return { sessionId, url: new URL(testCheckoutPath(sessionId), input.siteUrl).toString() };
    },
    async refund() {
      return { refundId: `re_test_kw_${newId()}` };
    },
  };
}

export type TestSession = Readonly<{
  sessionId: string;
  paymentId: string;
  brandId: string;
  mode: "payment" | "subscription";
  amountMinor: number;
  currency: PayCurrency;
  metadata: Readonly<Record<string, string>>;
}>;

/** The event Stripe would send when the person pays (or leaves) the test checkout, as a raw body. */
export function testCheckoutEvent(session: TestSession, outcome: "paid" | "expired", newId: () => string = () => randomUUID().replaceAll("-", "")): string {
  const subscription = session.mode === "subscription" ? `sub_test_kw_${newId()}` : null;
  const object = {
    id: session.sessionId,
    object: "checkout.session",
    mode: session.mode,
    status: outcome === "paid" ? "complete" : "expired",
    payment_status: outcome === "paid" ? "paid" : "unpaid",
    amount_total: session.amountMinor,
    currency: session.currency.toLowerCase(),
    client_reference_id: session.paymentId,
    payment_intent: outcome === "paid" && session.mode === "payment" ? `pi_test_kw_${newId()}` : null,
    subscription: outcome === "paid" ? subscription : null,
    customer: outcome === "paid" && subscription ? `cus_test_kw_${newId()}` : null,
    metadata: { payment_id: session.paymentId, brand_id: session.brandId, ...session.metadata },
  };
  return JSON.stringify({
    id: `evt_test_kw_${newId()}`,
    object: "event",
    type: outcome === "paid" ? "checkout.session.completed" : "checkout.session.expired",
    data: { object },
  });
}
