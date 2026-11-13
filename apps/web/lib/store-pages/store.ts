import { z } from "zod";
import type { ConnectEvent } from "./connect-events";
import type { ConnectName } from "./connect";

/**
 * The seller payout tables (migration 20261228040000), behind an interface so the payout run and the Connect events
 * are tested without a database (`fixtures/memory-payouts.ts`) and run against one through the server's key
 * (`db.ts`). Every write is one of the migration's functions; this file names them and reads their rows.
 */

export const PAYOUT_STATUSES = ["pending", "sent", "paid", "failed"] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

export interface PayoutRow {
  readonly id: string;
  readonly brandId: string | null;
  readonly currency: "GBP" | "AUD";
  readonly amountMinor: number;
  readonly status: PayoutStatus;
  readonly provider: ConnectName;
  readonly accountId: string;
  readonly transferId: string | null;
  readonly failure: string | null;
  readonly createdAt: string;
  readonly sentAt: string | null;
  readonly paidAt: string | null;
}

export type AccountUpdate = Extract<ConnectEvent, { kind: "account" }>;

export interface PayoutStore {
  /** Prepares this week's payouts and answers every one waiting to be sent. */
  prepare(asOf: Date): Promise<readonly PayoutRow[]>;
  markSent(payoutId: string, transferId: string): Promise<void>;
  markFailed(ref: Readonly<{ payoutId: string | null; transferId: string | null }>, reason: string): Promise<void>;
  /** The brand of the account, or null when the account is not ours. */
  updateAccount(update: AccountUpdate): Promise<string | null>;
  /** How many of our payouts the bank payout settled. */
  recordBankPayout(accountId: string, payoutId: string, status: "paid" | "failed", createdAt: Date | null): Promise<number>;
}

const minor = z.coerce.number().int();

export const payoutRow = z.object({
  id: z.uuid(),
  brand_id: z.uuid().nullable(),
  currency: z.enum(["GBP", "AUD"]),
  amount_minor: minor,
  status: z.enum(PAYOUT_STATUSES),
  provider: z.enum(["stripe", "test"]),
  provider_account_id: z.string(),
  provider_transfer_id: z.string().nullable(),
  failure: z.string().nullable(),
  created_at: z.string(),
  sent_at: z.string().nullable(),
  paid_at: z.string().nullable(),
});

export const PAYOUT_COLUMNS = Object.keys(payoutRow.shape).join(", ");

export const toPayout = (row: unknown): PayoutRow => {
  const r = payoutRow.parse(row);
  return {
    id: r.id,
    brandId: r.brand_id,
    currency: r.currency,
    amountMinor: r.amount_minor,
    status: r.status,
    provider: r.provider,
    accountId: r.provider_account_id,
    transferId: r.provider_transfer_id,
    failure: r.failure,
    createdAt: r.created_at,
    sentAt: r.sent_at,
    paidAt: r.paid_at,
  };
};

export interface SaleRow {
  readonly id: string;
  readonly channel: "storefront" | "team_store" | "shopify" | "api";
  readonly sourceRef: string;
  readonly productId: string | null;
  readonly productName: string;
  readonly quantity: number;
  readonly currency: "GBP" | "AUD";
  readonly retailMinor: number;
  readonly marginMinor: number;
  readonly refundedMinor: number;
  readonly deliveredAt: string | null;
  readonly soldAt: string;
}

export const saleRow = z.object({
  id: z.uuid(),
  channel: z.enum(["storefront", "team_store", "shopify", "api"]),
  source_ref: z.string(),
  product_id: z.uuid().nullable(),
  product_name: z.string(),
  quantity: z.number().int(),
  currency: z.enum(["GBP", "AUD"]),
  retail_minor: minor,
  margin_minor: minor,
  refunded_minor: minor,
  delivered_at: z.string().nullable(),
  sold_at: z.string(),
});

export const SALE_COLUMNS = Object.keys(saleRow.shape).join(", ");

export const toSale = (row: unknown): SaleRow => {
  const r = saleRow.parse(row);
  return {
    id: r.id,
    channel: r.channel,
    sourceRef: r.source_ref,
    productId: r.product_id,
    productName: r.product_name,
    quantity: r.quantity,
    currency: r.currency,
    retailMinor: r.retail_minor,
    marginMinor: r.margin_minor,
    refundedMinor: r.refunded_minor,
    deliveredAt: r.delivered_at,
    soldAt: r.sold_at,
  };
};

export interface AccountRow {
  readonly provider: ConnectName;
  readonly accountId: string;
  readonly country: string;
  readonly detailsSubmitted: boolean;
  readonly payoutsEnabled: boolean;
  readonly requirementsDue: number;
  readonly disabledReason: string | null;
  readonly payoutFailure: string | null;
}

export const accountRow = z.object({
  provider: z.enum(["stripe", "test"]),
  provider_account_id: z.string(),
  country: z.string(),
  details_submitted: z.boolean(),
  payouts_enabled: z.boolean(),
  requirements_due: z.number().int(),
  disabled_reason: z.string().nullable(),
  payout_failure: z.string().nullable(),
});

export const ACCOUNT_COLUMNS = Object.keys(accountRow.shape).join(", ");

export const toAccount = (row: unknown): AccountRow => {
  const r = accountRow.parse(row);
  return {
    provider: r.provider,
    accountId: r.provider_account_id,
    country: r.country,
    detailsSubmitted: r.details_submitted,
    payoutsEnabled: r.payouts_enabled,
    requirementsDue: r.requirements_due,
    disabledReason: r.disabled_reason,
    payoutFailure: r.payout_failure,
  };
};
