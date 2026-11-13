import { AppError } from "@/lib/server/core/errors";
import type { LogEvent } from "@/lib/server/core/guard";
import { planCredits } from "./billing";
import { parseEvent, type PaymentEvent } from "./events";
import type { ProviderName } from "./provider";
import { verifySignature } from "./signature";
import type { PaymentRow, PaymentsStore } from "./store";

/**
 * THE WEBHOOK (plan v6 C1, decision 0152). One function for Stripe's endpoint and the test checkout:
 *
 * 1. The signature is checked over the raw body (`signature.ts`); anything unsigned, stale or forged is a 400 and
 *    nothing is read.
 * 2. An event already handled is a 200 and nothing more (`payment_events`).
 * 3. The event is acted on. Every action is safe to repeat — a paid payment stays paid, a settled line is skipped,
 *    credits and refunds are keyed — so the event is recorded only AFTER it was handled: a failure part-way answers
 *    500 and Stripe sends it again.
 *
 * A paid amount that is not the amount asked for is refused by the database and left for a person (logged as an
 * error, answered 200, because sending it again would not change it).
 */

export type WebhookDeps = Readonly<{
  secret: string;
  provider: ProviderName;
  nowSeconds: () => number;
  store: PaymentsStore;
  fulfil: (paymentId: string) => Promise<unknown>;
  log: (event: LogEvent) => void;
}>;

export type WebhookAnswer = Readonly<{ status: 200 | 400 | 500; message: string }>;

async function afterPaid(deps: WebhookDeps, payment: PaymentRow, event: Extract<PaymentEvent, { kind: "checkout_paid" }>): Promise<void> {
  if (payment.purpose === "order") {
    await deps.fulfil(payment.id);
    return;
  }
  if (payment.brandId === null) return;
  if (payment.purpose === "credits" && payment.credits !== null) {
    await deps.store.grantCredits(payment.brandId, payment.credits, `purchase:${payment.id}`, "Credits bought");
  }
  if (payment.purpose === "plan" && payment.planId !== null && payment.planInterval !== null && event.subscription !== null) {
    await deps.store.recordSubscription({
      brandId: payment.brandId,
      planId: payment.planId,
      planInterval: payment.planInterval,
      status: "active",
      provider: deps.provider,
      customerId: event.customer,
      subscriptionId: event.subscription,
    });
    const credits = planCredits(payment.planId);
    if (credits > 0) await deps.store.grantCredits(payment.brandId, credits, `plan:${payment.id}`, "Plan credits");
  }
  await deps.store.finish(payment.id);
}

async function onPaid(deps: WebhookDeps, event: Extract<PaymentEvent, { kind: "checkout_paid" }>): Promise<string> {
  let payment: PaymentRow | null;
  try {
    payment = await deps.store.markPaid(event.sessionId, event.paymentIntent, event.amountMinor, event.currency);
  } catch (error) {
    if (!(error instanceof AppError) || error.code === "internal") throw error;
    deps.log({ level: "error", message: "A paid checkout did not match its payment; a person must look", where: `checkout ${event.sessionId}`, error });
    return "not matched";
  }
  if (payment === null) return "not ours";
  await afterPaid(deps, payment, event);
  return "paid";
}

async function onRefunded(deps: WebhookDeps, event: Extract<PaymentEvent, { kind: "charge_refunded" }>): Promise<string> {
  const payment = await deps.store.paymentByProviderPayment(event.paymentIntent);
  if (payment === null) return "not ours";
  const more = event.refundedMinor - payment.refundedMinor;
  if (more <= 0) return "already counted";
  await deps.store.recordRefund(payment.id, more, `${event.chargeId}:${event.refundedMinor}`, "Refunded in Stripe", null);
  return "refund recorded";
}

async function onInvoicePaid(deps: WebhookDeps, event: Extract<PaymentEvent, { kind: "invoice_paid" }>): Promise<string> {
  // The first period's credits come with the checkout itself.
  if (event.first) return "first period";
  const subscription = await deps.store.subscription(event.subscriptionId);
  if (subscription === null) return "not ours";
  const credits = planCredits(subscription.planId);
  if (credits > 0) await deps.store.grantCredits(subscription.brandId, credits, `plan:${event.invoiceId}`, "Plan credits");
  return "renewed";
}

async function act(deps: WebhookDeps, event: PaymentEvent): Promise<string> {
  switch (event.kind) {
    case "checkout_paid":
      return onPaid(deps, event);
    case "checkout_expired":
      await deps.store.markExpired(event.sessionId);
      return "expired";
    case "charge_refunded":
      return onRefunded(deps, event);
    case "subscription_changed":
      await deps.store.updateSubscription(event.subscriptionId, event.status, event.periodEnd);
      return "subscription";
    case "invoice_paid":
      return onInvoicePaid(deps, event);
    case "ignored":
      return "ignored";
  }
}

export async function receiveWebhook(deps: WebhookDeps, raw: string, signature: string | null): Promise<WebhookAnswer> {
  const check = verifySignature(signature, raw, deps.secret, deps.nowSeconds());
  if (!check.ok) return { status: 400, message: `Signature ${check.reason}.` };
  const parsed = parseEvent(raw);
  if (parsed === null) return { status: 400, message: "Not an event this endpoint reads." };
  if (await deps.store.seenEvent(parsed.id)) return { status: 200, message: "Already handled." };
  try {
    const outcome = await act(deps, parsed.event);
    await deps.store.recordEvent(parsed.id, parsed.type);
    return { status: 200, message: outcome };
  } catch (error) {
    deps.log({ level: "error", message: "A payment event could not be handled; Stripe will send it again", where: `event ${parsed.id} ${parsed.type}`, error });
    return { status: 500, message: "Not handled yet." };
  }
}
