import { z } from "zod";
import type { Drop } from "./drops";
import { CHANNELS, CURRENCIES, LISTING_MODES, LISTING_STATUSES, type Listing } from "./listing";
import { mediaItem } from "./listing-schema";

/**
 * The storefront tables' rows (migration 20261228030000) read into the models. Every row is parsed: a row this
 * deploy cannot read is a fault, not a half-shown listing.
 */

export interface Storefront {
  readonly brandId: string;
  readonly slug: string;
  readonly name: string;
  readonly status: "draft" | "live";
  readonly returnsPolicy: string;
  readonly euResponsiblePerson: string | null;
  readonly batchOwner: string | null;
}

export const STOREFRONT_COLUMNS = "brand_id, slug, name, status, returns_policy, eu_responsible_person, batch_owner";

const storefrontRow = z.object({
  brand_id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  status: z.enum(["draft", "live"]),
  returns_policy: z.string(),
  eu_responsible_person: z.string().nullable(),
  batch_owner: z.uuid().nullable(),
});

export const toStorefront = (row: unknown): Storefront => {
  const r = storefrontRow.parse(row);
  return { brandId: r.brand_id, slug: r.slug, name: r.name, status: r.status, returnsPolicy: r.returns_policy, euResponsiblePerson: r.eu_responsible_person, batchOwner: r.batch_owner };
};

export const LISTING_COLUMNS =
  "id, brand_id, product_id, title, description, tags, show_size_table, media, personalisation, name_max, number_min, number_max, personalisation_minor, currency, prices, mode, channel, hide_until_ready, sync_mockups, release_id, fabric_key, status, published_at, updated_at";

const listingRow = z.object({
  id: z.uuid(),
  brand_id: z.uuid(),
  product_id: z.uuid(),
  title: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  show_size_table: z.boolean(),
  media: z.array(mediaItem),
  personalisation: z.boolean(),
  name_max: z.number().int(),
  number_min: z.number().int(),
  number_max: z.number().int(),
  personalisation_minor: z.coerce.number().int(),
  currency: z.enum(CURRENCIES),
  prices: z.record(z.string(), z.coerce.number().int()),
  mode: z.enum(LISTING_MODES),
  channel: z.enum(CHANNELS),
  hide_until_ready: z.boolean(),
  sync_mockups: z.boolean(),
  release_id: z.uuid().nullable(),
  fabric_key: z.string().nullable(),
  status: z.enum(LISTING_STATUSES),
  published_at: z.string().nullable(),
  updated_at: z.string(),
});

export function toListing(row: unknown): Listing {
  const r = listingRow.parse(row);
  return {
    id: r.id,
    brandId: r.brand_id,
    productId: r.product_id,
    title: r.title,
    description: r.description,
    tags: r.tags,
    showSizeTable: r.show_size_table,
    media: r.media,
    personalisation: { enabled: r.personalisation, nameMax: r.name_max, numberMin: r.number_min, numberMax: r.number_max, extraMinor: r.personalisation_minor },
    currency: r.currency,
    prices: r.prices,
    mode: r.mode,
    channel: r.channel,
    hideUntilReady: r.hide_until_ready,
    syncMockups: r.sync_mockups,
    releaseId: r.release_id,
    fabricKey: r.fabric_key,
    status: r.status,
    publishedAt: r.published_at,
    updatedAt: r.updated_at,
  };
}

/** The columns a listing is saved with. The brand, product, status and release are set by their own writes. */
export const listingWrite = (listing: Listing, userId: string) => ({
  title: listing.title,
  description: listing.description,
  tags: [...listing.tags],
  show_size_table: listing.showSizeTable,
  media: listing.media,
  personalisation: listing.personalisation.enabled,
  name_max: listing.personalisation.nameMax,
  number_min: listing.personalisation.numberMin,
  number_max: listing.personalisation.numberMax,
  personalisation_minor: listing.personalisation.extraMinor,
  currency: listing.currency,
  prices: listing.prices,
  mode: listing.mode,
  channel: listing.channel,
  hide_until_ready: listing.hideUntilReady,
  sync_mockups: listing.syncMockups,
  fabric_key: listing.fabricKey,
  updated_by: userId,
  updated_at: new Date().toISOString(),
});

export const DROP_COLUMNS = "id, brand_id, collection_id, name, opens_at, closes_at, target_units, status";

const dropRow = z.object({
  id: z.uuid(),
  brand_id: z.uuid(),
  collection_id: z.uuid().nullable(),
  name: z.string(),
  opens_at: z.string(),
  closes_at: z.string(),
  target_units: z.number().int().nullable(),
  status: z.enum(["scheduled", "closed", "cancelled"]),
});

export const toDrop = (row: unknown): Drop => {
  const r = dropRow.parse(row);
  return { id: r.id, brandId: r.brand_id, collectionId: r.collection_id, name: r.name, opensAt: r.opens_at, closesAt: r.closes_at, targetUnits: r.target_units, status: r.status };
};

export interface ShopOrder {
  readonly id: string;
  readonly brandId: string | null;
  readonly listingId: string | null;
  readonly dropId: string | null;
  readonly paymentId: string;
  readonly size: string;
  readonly qty: number;
  readonly amountMinor: number;
  readonly currency: "GBP" | "AUD";
  readonly personalName: string | null;
  readonly personalNumber: number | null;
  readonly batchId: string | null;
  readonly accessHash: string;
  readonly createdAt: string;
}

export const SHOP_ORDER_COLUMNS =
  "id, brand_id, listing_id, drop_id, payment_id, size, qty, amount_minor, currency, personal_name, personal_number, batch_id, access_hash, created_at";

const shopOrderRow = z.object({
  id: z.uuid(),
  brand_id: z.uuid().nullable(),
  listing_id: z.uuid().nullable(),
  drop_id: z.uuid().nullable(),
  payment_id: z.uuid(),
  size: z.string(),
  qty: z.number().int(),
  amount_minor: z.coerce.number().int(),
  currency: z.enum(CURRENCIES),
  personal_name: z.string().nullable(),
  personal_number: z.number().int().nullable(),
  batch_id: z.uuid().nullable(),
  access_hash: z.string(),
  created_at: z.string(),
});

export const toShopOrder = (row: unknown): ShopOrder => {
  const r = shopOrderRow.parse(row);
  return {
    id: r.id, brandId: r.brand_id, listingId: r.listing_id, dropId: r.drop_id, paymentId: r.payment_id, size: r.size, qty: r.qty,
    amountMinor: r.amount_minor, currency: r.currency, personalName: r.personal_name, personalNumber: r.personal_number,
    batchId: r.batch_id, accessHash: r.access_hash, createdAt: r.created_at,
  };
};

export interface Batch {
  readonly id: string;
  readonly brandId: string | null;
  readonly listingId: string | null;
  readonly dropId: string | null;
  readonly kind: "weekly" | "drop";
  readonly cutoffAt: string;
  readonly sizes: Readonly<Record<string, number>>;
  readonly pieces: number;
  readonly status: "open" | "sent" | "refused";
  readonly orderId: string | null;
  readonly message: string | null;
}

export const BATCH_COLUMNS = "id, brand_id, listing_id, drop_id, kind, cutoff_at, sizes, pieces, status, order_id, message";

const batchRow = z.object({
  id: z.uuid(),
  brand_id: z.uuid().nullable(),
  listing_id: z.uuid().nullable(),
  drop_id: z.uuid().nullable(),
  kind: z.enum(["weekly", "drop"]),
  cutoff_at: z.string(),
  sizes: z.record(z.string(), z.number().int()),
  pieces: z.number().int(),
  status: z.enum(["open", "sent", "refused"]),
  order_id: z.uuid().nullable(),
  message: z.string().nullable(),
});

export const toBatch = (row: unknown): Batch => {
  const r = batchRow.parse(row);
  return { id: r.id, brandId: r.brand_id, listingId: r.listing_id, dropId: r.drop_id, kind: r.kind, cutoffAt: r.cutoff_at, sizes: r.sizes, pieces: r.pieces, status: r.status, orderId: r.order_id, message: r.message };
};
