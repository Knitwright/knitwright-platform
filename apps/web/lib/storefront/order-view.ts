import type { PaymentStatus } from "@/lib/payments/store";

/**
 * What the shopper's order page says (decision 0154): paid and waiting for its batch, in production, waiting for
 * Stripe's word, cancelled, or refunded. Only the webhook changes a payment; this page only reads it.
 */

export interface Headline {
  readonly title: string;
  readonly body: string;
  readonly tone: "ok" | "warn" | "info";
  /** True while Stripe has not said yet, so the page offers "Check again". */
  readonly waiting: boolean;
}

export function shopOrderHeadline(input: Readonly<{ status: PaymentStatus; cancelled: boolean; batched: boolean }>): Headline {
  if (input.status === "refunded") {
    return { title: "Refunded", body: "Your payment has been given back in full. It can take a few days to reach your card.", tone: "info", waiting: false };
  }
  if (input.status === "paid" || input.status === "fulfilled") {
    return input.batched
      ? { title: "In production", body: "Your order has gone to the factory with its batch. Keep the address of this page to check on it.", tone: "ok", waiting: false }
      : { title: "Thank you, your order is paid", body: "It goes to the factory with the next batch. Keep the address of this page to check on it.", tone: "ok", waiting: false };
  }
  if (input.status === "expired" || input.cancelled) {
    return { title: "Not paid", body: "The checkout was cancelled or ran out of time. Nothing was charged. Go back to the product to try again.", tone: "warn", waiting: false };
  }
  return { title: "Waiting for the payment", body: "Your card's answer has not reached us yet. This usually takes a few seconds.", tone: "info", waiting: true };
}
