import { AppError } from "@/lib/server/core/errors";
import type { PaymentProvider } from "./provider";
import type { PaymentRow, PaymentsStore } from "./store";

/**
 * REFUNDS (plan v6 C1, decision 0152). A refund goes to the processor first and is recorded once it says yes, with
 * the processor's refund id, so the `charge.refunded` webhook that follows finds it already counted. The database
 * refuses a refund larger than what is left of the charge. A refund made in Stripe's own dashboard arrives only as
 * the webhook and is recorded from there (`webhook.ts`).
 */

export type RefundDeps = Readonly<{ store: PaymentsStore; provider: PaymentProvider | null }>;

export const REFUND_NOT_SET_UP = "Card refunds are not set up on this deploy, so nothing was refunded.";

/** What is left of a card payment to refund. */
export const refundable = (payment: PaymentRow): number =>
  payment.method === "card" && ["paid", "fulfilled"].includes(payment.status) ? payment.amountMinor - payment.refundedMinor : 0;

export async function refundPayment(
  deps: RefundDeps,
  payment: PaymentRow,
  amountMinor: number,
  reason: string,
  actor: string | null,
): Promise<Readonly<{ refundId: string }>> {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0 || amountMinor > refundable(payment)) {
    throw new AppError("conflict", "A refund is more than nothing and never more than what is left of the charge.");
  }
  if (payment.providerPaymentId === null) throw new AppError("conflict", "This payment has no card charge to refund.");
  if (deps.provider === null || deps.provider.name !== payment.provider) throw new AppError("unavailable", REFUND_NOT_SET_UP);
  const { refundId } = await deps.provider.refund({
    paymentId: payment.id,
    providerPaymentId: payment.providerPaymentId,
    amountMinor,
    idempotencyKey: `refund:${payment.id}:${payment.refundedMinor}:${amountMinor}`,
  });
  await deps.store.recordRefund(payment.id, amountMinor, refundId, reason, actor);
  return { refundId };
}
