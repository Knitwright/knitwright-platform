import type { PayCurrency } from "./settings";

/**
 * The one seam to the card processor (plan v6 C1, decision 0152). Stripe is the only real one (`stripe.ts`); the
 * test checkout (`test-provider.ts`) stands in wherever there are no Stripe keys — CI, the browser tests, a local
 * run — and drives the same webhook path with events it signs itself. Nothing else in the app talks to Stripe.
 */

export type ProviderName = "stripe" | "test";

export interface CheckoutRequest {
  /** Our payment's id: Stripe's client reference, its metadata and the idempotency key. */
  readonly paymentId: string;
  readonly brandId: string;
  readonly mode: "payment" | "subscription";
  readonly currency: PayCurrency;
  /** What the card is charged: the whole amount, in minor units. For a subscription, each period's price. */
  readonly amountMinor: number;
  /** The line the person reads on Stripe's page. */
  readonly name: string;
  /** For a subscription: how often it is charged. */
  readonly interval?: "month" | "year";
  readonly successUrl: string;
  readonly cancelUrl: string;
  readonly customerEmail?: string;
  /** Extra metadata, such as the plan a subscription is for. */
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface CheckoutSession {
  readonly sessionId: string;
  readonly url: string;
}

export interface RefundRequest {
  readonly paymentId: string;
  /** Stripe's payment intent for the charge. */
  readonly providerPaymentId: string;
  readonly amountMinor: number;
  /** A key that makes a second press of the same refund do nothing. */
  readonly idempotencyKey: string;
}

export interface PaymentProvider {
  readonly name: ProviderName;
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
  refund(request: RefundRequest): Promise<Readonly<{ refundId: string }>>;
}

/** Thrown when the processor answers with an error. The message is for a log, not a person. */
export class ProviderError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ProviderError";
  }
}
