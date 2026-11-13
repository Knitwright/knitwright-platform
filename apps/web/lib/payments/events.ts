import { z } from "zod";
import { readConnectEvent, type ConnectEvent } from "@/lib/store-pages/connect-events";

/**
 * The Stripe events the platform acts on (plan v6 C1, decision 0152), read into plain shapes. Fields are read
 * leniently — Stripe adds fields and moves some between API versions — but the ones acted on are checked. Any
 * other event type is acknowledged and ignored.
 *
 * - `checkout.session.completed` / `.async_payment_succeeded`: a checkout was paid (when `payment_status` is paid).
 * - `checkout.session.expired`: abandoned or timed out.
 * - `charge.refunded`: a refund, possibly made in Stripe's dashboard. Read as the charge's total refunded so far.
 * - `customer.subscription.updated` / `.deleted`: a plan's state.
 * - `invoice.paid`: a plan's renewal, which gives the plan's credits for the period.
 */

const id = z.string().min(1).max(255);
const nullableId = z.preprocess((value) => (value !== null && typeof value === "object" && "id" in value ? (value as { id: unknown }).id : value), id.nullable().optional());
const metadata = z.record(z.string(), z.string()).nullable().optional().transform((value) => value ?? {});

const session = z.object({
  id,
  mode: z.enum(["payment", "subscription", "setup"]),
  payment_status: z.string(),
  amount_total: z.number().int().nullable().optional(),
  currency: z.string().nullable().optional(),
  payment_intent: nullableId,
  subscription: nullableId,
  customer: nullableId,
  metadata,
});

const charge = z.object({ id, payment_intent: nullableId, amount_refunded: z.number().int().min(0), currency: z.string() });

const subscription = z.object({
  id,
  status: z.string(),
  current_period_end: z.number().int().nullable().optional(),
  items: z.object({ data: z.array(z.object({ current_period_end: z.number().int().nullable().optional() }).loose()) }).loose().optional(),
  metadata,
});

const invoice = z.object({
  id,
  billing_reason: z.string().nullable().optional(),
  subscription: nullableId,
  parent: z.object({ subscription_details: z.object({ subscription: nullableId }).loose().nullable().optional() }).loose().nullable().optional(),
});

const envelope = z.object({ id, type: z.string().min(1).max(120), account: z.string().min(1).max(255).nullable().optional(), data: z.object({ object: z.unknown() }) });

export type PaymentEvent =
  | Readonly<{ kind: "checkout_paid"; sessionId: string; mode: "payment" | "subscription"; amountMinor: number; currency: string; paymentIntent: string | null; subscription: string | null; customer: string | null; metadata: Readonly<Record<string, string>> }>
  | Readonly<{ kind: "checkout_expired"; sessionId: string }>
  | Readonly<{ kind: "charge_refunded"; chargeId: string; paymentIntent: string; refundedMinor: number }>
  | Readonly<{ kind: "subscription_changed"; subscriptionId: string; status: string; periodEnd: Date | null }>
  | Readonly<{ kind: "invoice_paid"; invoiceId: string; subscriptionId: string; first: boolean }>
  | Readonly<{ kind: "connect"; event: ConnectEvent }>
  | Readonly<{ kind: "ignored" }>;

export type ParsedEvent = Readonly<{ id: string; type: string; event: PaymentEvent }>;

const at = (seconds: number | null | undefined): Date | null => (seconds === null || seconds === undefined ? null : new Date(seconds * 1000));

function checkoutEvent(object: unknown): PaymentEvent {
  const s = session.parse(object);
  if (s.payment_status !== "paid" || s.mode === "setup" || s.amount_total === null || s.amount_total === undefined || !s.currency) return { kind: "ignored" };
  return {
    kind: "checkout_paid",
    sessionId: s.id,
    mode: s.mode,
    amountMinor: s.amount_total,
    currency: s.currency.toUpperCase(),
    paymentIntent: s.payment_intent ?? null,
    subscription: s.subscription ?? null,
    customer: s.customer ?? null,
    metadata: s.metadata,
  };
}

function subscriptionEvent(object: unknown): PaymentEvent {
  const s = subscription.parse(object);
  const end = s.current_period_end ?? s.items?.data[0]?.current_period_end ?? null;
  return { kind: "subscription_changed", subscriptionId: s.id, status: s.status, periodEnd: at(end) };
}

function invoiceEvent(object: unknown): PaymentEvent {
  const i = invoice.parse(object);
  const subscriptionId = i.subscription ?? i.parent?.subscription_details?.subscription ?? null;
  if (!subscriptionId) return { kind: "ignored" };
  return { kind: "invoice_paid", invoiceId: i.id, subscriptionId, first: i.billing_reason === "subscription_create" };
}

function chargeEvent(object: unknown): PaymentEvent {
  const c = charge.parse(object);
  if (!c.payment_intent) return { kind: "ignored" };
  return { kind: "charge_refunded", chargeId: c.id, paymentIntent: c.payment_intent, refundedMinor: c.amount_refunded };
}

const READERS: Readonly<Record<string, (object: unknown) => PaymentEvent>> = {
  "checkout.session.completed": checkoutEvent,
  "checkout.session.async_payment_succeeded": checkoutEvent,
  "checkout.session.expired": (object) => ({ kind: "checkout_expired", sessionId: z.object({ id }).parse(object).id }),
  "charge.refunded": chargeEvent,
  "customer.subscription.updated": subscriptionEvent,
  "customer.subscription.deleted": subscriptionEvent,
  "invoice.paid": invoiceEvent,
};

/** The event in a raw body, or null when the body is not a Stripe event this code can read. */
export function parseEvent(raw: string): ParsedEvent | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const outer = envelope.safeParse(json);
  if (!outer.success) return null;
  const connect = readConnectEvent(outer.data.type, outer.data.data.object, outer.data.account ?? null);
  if (connect === null) return null;
  if (connect !== undefined) return { id: outer.data.id, type: outer.data.type, event: { kind: "connect", event: connect } };
  const reader = READERS[outer.data.type];
  if (!reader) return { id: outer.data.id, type: outer.data.type, event: { kind: "ignored" } };
  try {
    return { id: outer.data.id, type: outer.data.type, event: reader(outer.data.data.object) };
  } catch {
    return null;
  }
}
