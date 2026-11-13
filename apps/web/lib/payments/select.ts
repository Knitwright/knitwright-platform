import { createHmac } from "node:crypto";
import type { PaymentProvider } from "./provider";
import { stripeProvider } from "./stripe";
import { testProvider } from "./test-provider";

/**
 * Which processor this deploy uses (plan v6 C1, decision 0152), from the environment:
 *
 * - STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET both set: Stripe, in test mode (the environment check refuses a
 *   live key). Either alone is a misconfiguration: a checkout whose webhook cannot be checked would take money
 *   that never reaches production, so checkout is shown as not set up.
 * - otherwise PAYMENTS_TEST_CHECKOUT=on: the test checkout, whose events are signed with a secret derived from the
 *   server's own key, so nobody outside can forge one even on a machine running it.
 * - otherwise none: card checkout is not set up, and an order with a price cannot be paid.
 */

export type PaymentsEnv = Readonly<{
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_AUTOMATIC_TAX?: "on" | "off";
  PAYMENTS_TEST_CHECKOUT?: "on" | "off";
  SUPABASE_SECRET_KEY: string;
  NEXT_PUBLIC_SITE_URL: string;
}>;

export type Payments = Readonly<{ provider: PaymentProvider; webhookSecret: string }>;

/** The test checkout's webhook secret: derived, never configured, never the same as another deploy's. */
export const testWebhookSecret = (serverKey: string): string => `whsec_test_${createHmac("sha256", serverKey).update("knitwright-test-checkout").digest("hex")}`;

export function paymentsFrom(env: PaymentsEnv): Payments | null {
  if (env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET) {
    return {
      provider: stripeProvider({ secretKey: env.STRIPE_SECRET_KEY, automaticTax: env.STRIPE_AUTOMATIC_TAX === "on" }),
      webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    };
  }
  if (!env.STRIPE_SECRET_KEY && !env.STRIPE_WEBHOOK_SECRET && env.PAYMENTS_TEST_CHECKOUT === "on") {
    return { provider: testProvider({ siteUrl: env.NEXT_PUBLIC_SITE_URL }), webhookSecret: testWebhookSecret(env.SUPABASE_SECRET_KEY) };
  }
  return null;
}
