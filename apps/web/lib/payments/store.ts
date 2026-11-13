import { z } from "zod";
import type { ProviderName } from "./provider";
import type { PayCurrency, PaymentSettings, Schedule } from "./settings";

/**
 * The payment tables (migration 20261228010000), behind an interface so the rules can be tested without a database
 * (`fixtures/memory-store.ts`) and run against one through the server's key (`server.ts`). Every write is one of the
 * migration's functions; this file only names them and reads their rows.
 */

export const PAYMENT_STATUSES = ["open", "paid", "fulfilled", "invoice", "expired", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type Purpose = "order" | "credits" | "plan";
export type Door = "make" | "brand_run";

export interface PaymentRow {
  readonly id: string;
  readonly brandId: string | null;
  readonly purpose: Purpose;
  readonly method: "card" | "invoice";
  readonly status: PaymentStatus;
  readonly currency: PayCurrency;
  readonly orderValueMinor: number | null;
  readonly amountMinor: number;
  readonly schedule: Schedule;
  readonly balanceDueMinor: number;
  readonly refundedMinor: number;
  readonly provider: ProviderName | null;
  readonly sessionId: string | null;
  readonly providerPaymentId: string | null;
  readonly credits: number | null;
  readonly planId: string | null;
  readonly planInterval: "month" | "year" | null;
  readonly description: string;
  readonly createdBy: string | null;
  readonly createdAt: string;
}

export interface NewLine {
  readonly requestKey: string;
  readonly door: Door;
  readonly productId: string;
  readonly projectId: string;
  readonly kind: "sample" | "run";
  readonly releaseId: string;
  readonly factoryProfileId: string;
  readonly fabricKey: string;
  readonly sizes: Readonly<Record<string, number>>;
  readonly flags: readonly Readonly<{ code: string; text: string }>[];
  readonly pieces: number;
  /** Null where no price is on file: the whole payment is then an invoice. */
  readonly valueMinor: number | null;
  readonly priceLabel: string | null;
}

export interface LineRow extends NewLine {
  readonly id: string;
  readonly paymentId: string;
  readonly status: "waiting" | "submitted" | "refused";
  readonly orderId: string | null;
  readonly runId: string | null;
  readonly message: string | null;
}

export interface OpenPayment {
  readonly brandId: string;
  readonly userId: string;
  readonly purpose: Purpose;
  readonly method: "card" | "invoice";
  readonly currency: PayCurrency;
  readonly orderValueMinor: number | null;
  readonly amountMinor: number;
  readonly schedule: Schedule;
  readonly description: string;
  readonly credits: number | null;
  readonly planId: string | null;
  readonly planInterval: "month" | "year" | null;
  readonly lines: readonly NewLine[];
}

export interface SubscriptionRecord {
  readonly brandId: string;
  readonly planId: string;
  readonly planInterval: "month" | "year";
  readonly status: string;
  readonly provider: ProviderName;
  readonly customerId: string | null;
  readonly subscriptionId: string;
}

export interface PaymentsStore {
  open(input: OpenPayment): Promise<string>;
  attachSession(paymentId: string, provider: ProviderName, sessionId: string): Promise<void>;
  /** Throws a `payment_mismatch` refusal when the amount or currency is not the one asked for. */
  markPaid(sessionId: string, providerPaymentId: string | null, amountMinor: number, currency: string): Promise<PaymentRow | null>;
  markExpired(sessionId: string): Promise<void>;
  payment(id: string): Promise<PaymentRow | null>;
  paymentBySession(sessionId: string): Promise<PaymentRow | null>;
  paymentByProviderPayment(providerPaymentId: string): Promise<PaymentRow | null>;
  lines(paymentId: string): Promise<readonly LineRow[]>;
  settleLine(lineId: string, status: "submitted" | "refused", orderId: string | null, runId: string | null, message: string | null): Promise<void>;
  finish(paymentId: string): Promise<void>;
  seenEvent(eventId: string): Promise<boolean>;
  recordEvent(eventId: string, type: string): Promise<boolean>;
  recordRefund(paymentId: string, amountMinor: number, refundId: string | null, reason: string, actor: string | null): Promise<boolean>;
  settings(): Promise<PaymentSettings>;
  grantCredits(brandId: string, amount: number, key: string, note: string): Promise<void>;
  recordSubscription(record: SubscriptionRecord): Promise<void>;
  updateSubscription(subscriptionId: string, status: string, periodEnd: Date | null): Promise<void>;
  subscription(subscriptionId: string): Promise<Readonly<{ brandId: string; planId: string }> | null>;
}

const minor = z.coerce.number().int().min(0);

export const paymentRow = z.object({
  id: z.uuid(),
  brand_id: z.uuid().nullable(),
  purpose: z.enum(["order", "credits", "plan"]),
  method: z.enum(["card", "invoice"]),
  status: z.enum(PAYMENT_STATUSES),
  currency: z.enum(["GBP", "AUD"]),
  order_value_minor: minor.nullable(),
  amount_minor: minor,
  schedule: z.enum(["full", "deposit"]),
  balance_due_minor: minor,
  refunded_minor: minor,
  provider: z.enum(["stripe", "test"]).nullable(),
  provider_session_id: z.string().nullable(),
  provider_payment_id: z.string().nullable(),
  credits: z.number().int().nullable(),
  plan_id: z.string().nullable(),
  plan_interval: z.enum(["month", "year"]).nullable(),
  description: z.string(),
  created_by: z.uuid().nullable(),
  created_at: z.string(),
});

export const PAYMENT_COLUMNS = Object.keys(paymentRow.shape).join(", ");

export const toPayment = (row: unknown): PaymentRow => {
  const r = paymentRow.parse(row);
  return {
    id: r.id,
    brandId: r.brand_id,
    purpose: r.purpose,
    method: r.method,
    status: r.status,
    currency: r.currency,
    orderValueMinor: r.order_value_minor,
    amountMinor: r.amount_minor,
    schedule: r.schedule,
    balanceDueMinor: r.balance_due_minor,
    refundedMinor: r.refunded_minor,
    provider: r.provider,
    sessionId: r.provider_session_id,
    providerPaymentId: r.provider_payment_id,
    credits: r.credits,
    planId: r.plan_id,
    planInterval: r.plan_interval,
    description: r.description,
    createdBy: r.created_by,
    createdAt: r.created_at,
  };
};

export const lineRow = z.object({
  id: z.uuid(),
  payment_id: z.uuid(),
  request_key: z.string(),
  door: z.enum(["make", "brand_run"]),
  product_id: z.uuid(),
  project_id: z.uuid(),
  kind: z.enum(["sample", "run"]),
  release_id: z.uuid(),
  factory_profile_id: z.string(),
  fabric_key: z.string(),
  sizes: z.record(z.string(), z.number().int()),
  flags: z.array(z.object({ code: z.string(), text: z.string() })),
  pieces: z.number().int(),
  value_minor: minor.nullable(),
  price_label: z.string().nullable(),
  status: z.enum(["waiting", "submitted", "refused"]),
  order_id: z.uuid().nullable(),
  run_id: z.uuid().nullable(),
  message: z.string().nullable(),
});

export const LINE_COLUMNS = Object.keys(lineRow.shape).join(", ");

export const toLine = (row: unknown): LineRow => {
  const r = lineRow.parse(row);
  return {
    id: r.id,
    paymentId: r.payment_id,
    requestKey: r.request_key,
    door: r.door,
    productId: r.product_id,
    projectId: r.project_id,
    kind: r.kind,
    releaseId: r.release_id,
    factoryProfileId: r.factory_profile_id,
    fabricKey: r.fabric_key,
    sizes: r.sizes,
    flags: r.flags,
    pieces: r.pieces,
    valueMinor: r.value_minor,
    priceLabel: r.price_label,
    status: r.status,
    orderId: r.order_id,
    runId: r.run_id,
    message: r.message,
  };
};

/** The lines as `open_order_payment` reads them. */
export const linesForDatabase = (lines: readonly NewLine[]) =>
  lines.map((line) => ({
    request_key: line.requestKey,
    door: line.door,
    product_id: line.productId,
    project_id: line.projectId,
    kind: line.kind,
    release_id: line.releaseId,
    factory_profile_id: line.factoryProfileId,
    fabric_key: line.fabricKey,
    sizes: line.sizes,
    flags: line.flags,
    pieces: line.pieces,
    value_minor: line.valueMinor,
    price_label: line.priceLabel,
  }));
