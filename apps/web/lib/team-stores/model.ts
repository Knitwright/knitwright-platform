import { z } from "zod";

/**
 * A TEAM STORE WINDOW (plan v6 C2, decision 0153; spec F-T6) as the app reads it from `team_stores` (migration
 * 20261228020000). The database holds the rules a store must keep; this file only names its columns and reads a
 * row into a typed shape. Money is integer minor units.
 */

export const STORE_STATUSES = ["open", "closing", "closed", "refunding", "refunded"] as const;
export type StoreStatus = (typeof STORE_STATUSES)[number];

export { DEFAULT_MIN_PIECES, DEFAULT_NUMBER_RANGE, MARGIN_BPS, MAX_PIECES_PER_ORDER, type MarginBps } from "./constants";

export interface TeamStore {
  readonly id: string;
  readonly brandId: string;
  readonly code: string;
  readonly title: string;
  readonly projectId: string;
  readonly productId: string;
  readonly releaseId: string;
  readonly factoryProfileId: string;
  readonly fabricKey: string;
  readonly flags: readonly Readonly<{ code: string; text: string }>[];
  readonly currency: "GBP" | "AUD";
  readonly unitMinor: number;
  readonly priceLabel: string;
  readonly marginBps: number;
  readonly marginMinor: number;
  readonly sizes: readonly string[];
  readonly namesNumbers: boolean;
  readonly nameMax: number;
  readonly numberMin: number;
  readonly numberMax: number;
  readonly minPieces: number;
  readonly seasonId: string | null;
  readonly opensAt: string;
  readonly closesAt: string;
  readonly status: StoreStatus;
  readonly piecesSold: number | null;
  readonly closeSizes: Readonly<Record<string, number>> | null;
  readonly closeRequestKey: string | null;
  readonly orderId: string | null;
  readonly closeMessage: string | null;
  readonly marginOwedMinor: number | null;
  readonly closedAt: string | null;
  readonly createdBy: string | null;
}

const minor = z.coerce.number().int().min(0);

const storeRow = z.object({
  id: z.uuid(),
  brand_id: z.uuid(),
  code: z.string(),
  title: z.string(),
  project_id: z.uuid(),
  product_id: z.uuid(),
  release_id: z.uuid(),
  factory_profile_id: z.string(),
  fabric_key: z.string(),
  flags: z.array(z.object({ code: z.string(), text: z.string() })),
  currency: z.enum(["GBP", "AUD"]),
  unit_minor: minor,
  price_label: z.string(),
  margin_bps: z.number().int(),
  margin_minor: minor,
  sizes: z.array(z.string()),
  names_numbers: z.boolean(),
  name_max: z.number().int(),
  number_min: z.number().int(),
  number_max: z.number().int(),
  min_pieces: z.number().int(),
  season_id: z.uuid().nullable(),
  opens_at: z.string(),
  closes_at: z.string(),
  status: z.enum(STORE_STATUSES),
  pieces_sold: z.number().int().nullable(),
  close_sizes: z.record(z.string(), z.number().int()).nullable(),
  close_request_key: z.string().nullable(),
  order_id: z.uuid().nullable(),
  close_message: z.string().nullable(),
  margin_owed_minor: minor.nullable(),
  closed_at: z.string().nullable(),
  created_by: z.uuid().nullable(),
});

export const STORE_COLUMNS = Object.keys(storeRow.shape).join(", ");

export function toStore(row: unknown): TeamStore {
  const r = storeRow.parse(row);
  return {
    id: r.id,
    brandId: r.brand_id,
    code: r.code,
    title: r.title,
    projectId: r.project_id,
    productId: r.product_id,
    releaseId: r.release_id,
    factoryProfileId: r.factory_profile_id,
    fabricKey: r.fabric_key,
    flags: r.flags,
    currency: r.currency,
    unitMinor: r.unit_minor,
    priceLabel: r.price_label,
    marginBps: r.margin_bps,
    marginMinor: r.margin_minor,
    sizes: r.sizes,
    namesNumbers: r.names_numbers,
    nameMax: r.name_max,
    numberMin: r.number_min,
    numberMax: r.number_max,
    minPieces: r.min_pieces,
    seasonId: r.season_id,
    opensAt: r.opens_at,
    closesAt: r.closes_at,
    status: r.status,
    piecesSold: r.pieces_sold,
    closeSizes: r.close_sizes,
    closeRequestKey: r.close_request_key,
    orderId: r.order_id,
    closeMessage: r.close_message,
    marginOwedMinor: r.margin_owed_minor,
    closedAt: r.closed_at,
    createdBy: r.created_by,
  };
}

/** One purchase as the club reads it: who bought, how many, and whether their money is in. */
export interface StorePurchase {
  readonly id: string;
  readonly paymentId: string;
  readonly buyerName: string;
  readonly buyerEmail: string;
  readonly pieces: number;
  readonly amountMinor: number;
  readonly counted: boolean;
  readonly paymentStatus: string;
  readonly lines: readonly PurchaseLine[];
}

export interface PurchaseLine {
  readonly sizeLabel: string;
  readonly printName: string;
  readonly printNumber: string;
}

const purchaseRow = z.object({
  id: z.uuid(),
  payment_id: z.uuid(),
  buyer_name: z.string(),
  buyer_email: z.string(),
  pieces: z.number().int(),
  amount_minor: minor,
  counted: z.boolean(),
  order_payments: z.object({ status: z.string() }).nullable(),
  team_store_order_lines: z.array(z.object({ position: z.number().int(), size_label: z.string(), print_name: z.string(), print_number: z.string() })),
});

export const PURCHASE_SELECT =
  "id, payment_id, buyer_name, buyer_email, pieces, amount_minor, counted, order_payments(status), team_store_order_lines(position, size_label, print_name, print_number)";

export function toPurchase(row: unknown): StorePurchase {
  const r = purchaseRow.parse(row);
  return {
    id: r.id,
    paymentId: r.payment_id,
    buyerName: r.buyer_name,
    buyerEmail: r.buyer_email,
    pieces: r.pieces,
    amountMinor: r.amount_minor,
    counted: r.counted,
    paymentStatus: r.order_payments?.status ?? "open",
    lines: [...r.team_store_order_lines]
      .sort((a, b) => a.position - b.position)
      .map((line) => ({ sizeLabel: line.size_label, printName: line.print_name, printNumber: line.print_number })),
  };
}

/** A purchase whose money has arrived and not gone back. */
export const isPaid = (purchase: Pick<StorePurchase, "paymentStatus">): boolean => purchase.paymentStatus === "paid" || purchase.paymentStatus === "fulfilled";
