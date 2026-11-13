import { randomUUID } from "node:crypto";
import { AppError } from "@/lib/server/core/errors";
import { settingsOf, type PaymentSettings } from "../settings";
import type { LineRow, OpenPayment, PaymentRow, PaymentsStore, SubscriptionRecord } from "../store";

/**
 * The payment tables in memory, for the unit tests: the same rules the migration's functions hold that the code
 * relies on (a paid amount must match, a refund never exceeds the charge, an event is recorded once, a settled line
 * never moves), so the tests catch a rule broken in the code even without a database.
 */

export const DEFAULT_SETTINGS: PaymentSettings = settingsOf({
  refund_reserve_bps: 1000,
  deposit_bps: 4000,
  deposit_threshold_gbp_minor: 200_000,
  deposit_threshold_aud_minor: null,
  unpriced_orders: "invoice",
  is_placeholder: true,
  label: "Spec defaults",
});

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

export function memoryStore(settings: PaymentSettings = DEFAULT_SETTINGS) {
  const payments = new Map<string, Mutable<PaymentRow>>();
  const lines: Mutable<LineRow>[] = [];
  const events = new Map<string, string>();
  const refunds: { paymentId: string; amountMinor: number; refundId: string | null; reason: string }[] = [];
  const credits: { brandId: string; amount: number; key: string }[] = [];
  const subscriptions = new Map<string, Mutable<SubscriptionRecord> & { periodEnd: Date | null }>();

  const open = async (input: OpenPayment): Promise<string> => {
    const first = input.lines[0];
    const existing = first ? lines.find((line) => line.requestKey === first.requestKey) : undefined;
    if (existing) return existing.paymentId;
    const id = randomUUID();
    const invoice = input.method === "invoice";
    payments.set(id, {
      id, brandId: input.brandId, purpose: input.purpose, method: input.method, status: invoice ? "invoice" : "open", currency: input.currency,
      orderValueMinor: invoice ? null : input.orderValueMinor, amountMinor: invoice ? 0 : input.amountMinor, schedule: input.schedule,
      balanceDueMinor: input.purpose === "order" && !invoice ? (input.orderValueMinor ?? 0) - input.amountMinor : 0, refundedMinor: 0,
      provider: null, sessionId: null, providerPaymentId: null, credits: input.credits, planId: input.planId, planInterval: input.planInterval,
      description: input.description, createdBy: input.userId, createdAt: new Date().toISOString(),
    });
    for (const line of input.lines) lines.push({ ...line, id: randomUUID(), paymentId: id, status: "waiting", orderId: null, runId: null, message: null });
    return id;
  };

  const bySession = (sessionId: string) => [...payments.values()].find((one) => one.sessionId === sessionId) ?? null;

  const store: PaymentsStore = {
    open,
    attachSession: async (paymentId, provider, sessionId) => {
      const payment = payments.get(paymentId);
      if (!payment || payment.status !== "open") throw new AppError("conflict", "That payment is not waiting for a checkout.");
      payment.provider = provider;
      payment.sessionId = sessionId;
    },
    markPaid: async (sessionId, providerPaymentId, amountMinor, currency) => {
      const payment = bySession(sessionId);
      if (!payment) return null;
      if (payment.status !== "open" && payment.status !== "expired") return { ...payment };
      if (payment.amountMinor !== amountMinor || payment.currency !== currency.toUpperCase()) throw new AppError("conflict", "The amount paid is not the amount asked for.");
      payment.status = "paid";
      payment.providerPaymentId = providerPaymentId;
      return { ...payment };
    },
    markExpired: async (sessionId) => {
      const payment = bySession(sessionId);
      if (payment?.status === "open") payment.status = "expired";
    },
    payment: async (id) => (payments.has(id) ? { ...payments.get(id)! } : null),
    paymentBySession: async (sessionId) => bySession(sessionId),
    paymentByProviderPayment: async (id) => [...payments.values()].find((one) => one.providerPaymentId === id) ?? null,
    lines: async (paymentId) => lines.filter((line) => line.paymentId === paymentId).map((line) => ({ ...line })),
    settleLine: async (lineId, status, orderId, runId, message) => {
      const line = lines.find((one) => one.id === lineId);
      if (!line || line.status !== "waiting") return;
      Object.assign(line, { status, orderId, runId, message });
    },
    finish: async (paymentId) => {
      const payment = payments.get(paymentId);
      if (!payment || !["paid", "invoice"].includes(payment.status)) return;
      if (lines.some((line) => line.paymentId === paymentId && line.status === "waiting")) return;
      payment.status = "fulfilled";
    },
    seenEvent: async (eventId) => events.has(eventId),
    recordEvent: async (eventId, type) => {
      if (events.has(eventId)) return false;
      events.set(eventId, type);
      return true;
    },
    recordRefund: async (paymentId, amountMinor, refundId, reason) => {
      const payment = payments.get(paymentId)!;
      if (refundId !== null && refunds.some((one) => one.refundId === refundId)) return false;
      if (payment.refundedMinor + amountMinor > payment.amountMinor) throw new AppError("conflict", "Refund too large.");
      refunds.push({ paymentId, amountMinor, refundId, reason });
      payment.refundedMinor += amountMinor;
      if (payment.refundedMinor === payment.amountMinor) payment.status = "refunded";
      return true;
    },
    settings: async () => settings,
    grantCredits: async (brandId, amount, key) => {
      if (!credits.some((one) => one.key === key)) credits.push({ brandId, amount, key });
    },
    recordSubscription: async (record) => {
      subscriptions.set(record.subscriptionId, { ...record, periodEnd: null });
    },
    updateSubscription: async (subscriptionId, status, periodEnd) => {
      const found = subscriptions.get(subscriptionId);
      if (found) Object.assign(found, { status, periodEnd });
    },
    subscription: async (subscriptionId) => {
      const found = subscriptions.get(subscriptionId);
      return found ? { brandId: found.brandId, planId: found.planId } : null;
    },
  };
  return { store, payments, lines, events, refunds, credits, subscriptions };
}
