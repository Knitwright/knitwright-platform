import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AppError } from "@/lib/server/core/errors";
import type { OpenedShopOrder, ShopOrderBody } from "./checkout";
import { SHOP_REFUSALS } from "./checkout";
import type { Drop } from "./drops";
import type { Listing } from "./listing";
import {
  BATCH_COLUMNS,
  DROP_COLUMNS,
  LISTING_COLUMNS,
  SHOP_ORDER_COLUMNS,
  STOREFRONT_COLUMNS,
  listingWrite,
  toBatch,
  toDrop,
  toListing,
  toShopOrder,
  toStorefront,
  type Batch,
  type ShopOrder,
  type Storefront,
} from "./rows";

/**
 * The storefront tables through a Supabase client (migration 20261228030000). A member's own client reads under row
 * level security; the server's key writes, after the action has checked the person may. The rules live in the
 * tested files beside this one; the database and browser tests cover these joins.
 */

const fail = (error: unknown, what: string): never => {
  throw new AppError("internal", `${what} could not be read.`, undefined, { cause: error });
};

const rows = <T>(answer: { data: unknown; error: unknown }, map: (row: unknown) => T, what: string): readonly T[] => {
  if (answer.error) fail(answer.error, what);
  return ((answer.data as unknown[] | null) ?? []).map(map);
};

const one = <T>(answer: { data: unknown; error: unknown }, map: (row: unknown) => T, what: string): T | null => {
  if (answer.error) fail(answer.error, what);
  return answer.data ? map(answer.data) : null;
};

export const readStorefront = async (client: SupabaseClient, brandId: string): Promise<Storefront | null> =>
  one(await client.from("storefronts").select(STOREFRONT_COLUMNS).eq("brand_id", brandId).maybeSingle(), toStorefront, "The storefront");

export const storefrontBySlug = async (client: SupabaseClient, slug: string): Promise<Storefront | null> =>
  one(await client.from("storefronts").select(STOREFRONT_COLUMNS).eq("slug", slug).maybeSingle(), toStorefront, "The storefront");

export async function writeStorefront(admin: SupabaseClient, row: Record<string, unknown>): Promise<"saved" | "slug_taken"> {
  const { error } = await admin.from("storefronts").upsert(row, { onConflict: "brand_id" });
  if (error && (error as { code?: string }).code === "23505") return "slug_taken";
  if (error) throw new AppError("internal", "The storefront could not be saved.", undefined, { cause: error });
  return "saved";
}

export const readListing = async (client: SupabaseClient, brandId: string, productId: string): Promise<Listing | null> =>
  one(await client.from("listings").select(LISTING_COLUMNS).eq("brand_id", brandId).eq("product_id", productId).maybeSingle(), toListing, "The listing");

export const listingById = async (client: SupabaseClient, listingId: string): Promise<Listing | null> =>
  one(await client.from("listings").select(LISTING_COLUMNS).eq("id", listingId).maybeSingle(), toListing, "The listing");

export const readListings = async (client: SupabaseClient, brandId: string): Promise<readonly Listing[]> =>
  rows(await client.from("listings").select(LISTING_COLUMNS).eq("brand_id", brandId).order("updated_at", { ascending: false }), toListing, "The listings");

/** The listings a storefront shows: published, on the storefront channel. */
export const publishedListings = async (admin: SupabaseClient, brandId: string): Promise<readonly Listing[]> =>
  rows(
    await admin.from("listings").select(LISTING_COLUMNS).eq("brand_id", brandId).eq("status", "published").eq("channel", "storefront").order("published_at", { ascending: false }),
    toListing,
    "The listings",
  );

/** Saves the listing's fields; makes the row on the first save. Answers its id. */
export async function writeListing(admin: SupabaseClient, listing: Listing, userId: string): Promise<string> {
  const fields = listingWrite(listing, userId);
  const answer = listing.id
    ? await admin.from("listings").update(fields).eq("id", listing.id).eq("brand_id", listing.brandId).select("id").single()
    : await admin.from("listings").insert({ ...fields, brand_id: listing.brandId, product_id: listing.productId }).select("id").single();
  if (answer.error) throw new AppError("internal", "The listing could not be saved.", undefined, { cause: answer.error });
  return z.object({ id: z.uuid() }).parse(answer.data).id;
}

export async function setListingStatus(
  admin: SupabaseClient,
  listing: Pick<Listing, "id" | "brandId">,
  change: Readonly<{ status: "draft" | "published" | "archived"; releaseId?: string; userId: string }>,
): Promise<void> {
  const published = change.status === "published" ? { release_id: change.releaseId, published_at: new Date().toISOString(), published_by: change.userId } : {};
  const { error } = await admin.from("listings").update({ status: change.status, ...published, updated_by: change.userId, updated_at: new Date().toISOString() }).eq("id", listing.id).eq("brand_id", listing.brandId);
  if (error) throw new AppError("internal", "The listing could not be published.", undefined, { cause: error });
}

export const readDrops = async (client: SupabaseClient, brandId: string): Promise<readonly Drop[]> =>
  rows(await client.from("storefront_drops").select(DROP_COLUMNS).eq("brand_id", brandId).order("opens_at", { ascending: false }), toDrop, "The drops");

export async function dropListingIds(client: SupabaseClient, dropIds: readonly string[]): Promise<ReadonlyMap<string, readonly string[]>> {
  if (dropIds.length === 0) return new Map();
  const answer = await client.from("storefront_drop_listings").select("drop_id, listing_id").in("drop_id", [...dropIds]);
  const parsed = rows(answer, (row) => z.object({ drop_id: z.uuid(), listing_id: z.uuid() }).parse(row), "The drops");
  const map = new Map<string, string[]>();
  for (const row of parsed) map.set(row.drop_id, [...(map.get(row.drop_id) ?? []), row.listing_id]);
  return map;
}

/** The drops that sell a listing now or later, for its product page. */
export async function dropsOfListing(admin: SupabaseClient, listingId: string): Promise<readonly Drop[]> {
  const answer = await admin.from("storefront_drop_listings").select(`storefront_drops(${DROP_COLUMNS})`).eq("listing_id", listingId);
  return rows(answer, (row) => toDrop((row as { storefront_drops: unknown }).storefront_drops), "The drops");
}

export async function insertDrop(
  admin: SupabaseClient,
  drop: Readonly<{ brandId: string; collectionId: string; name: string; opensAt: string; closesAt: string; targetUnits: number | null; userId: string }>,
  listings: readonly Readonly<{ listingId: string; targetUnits: number | null }>[],
): Promise<string> {
  const made = await admin
    .from("storefront_drops")
    .insert({ brand_id: drop.brandId, collection_id: drop.collectionId, name: drop.name, opens_at: drop.opensAt, closes_at: drop.closesAt, target_units: drop.targetUnits, created_by: drop.userId })
    .select("id")
    .single();
  if (made.error) throw new AppError("internal", "The drop could not be made.", undefined, { cause: made.error });
  const id = z.object({ id: z.uuid() }).parse(made.data).id;
  const linked = await admin.from("storefront_drop_listings").insert(listings.map((one) => ({ drop_id: id, listing_id: one.listingId, brand_id: drop.brandId, target_units: one.targetUnits })));
  if (linked.error) {
    await admin.from("storefront_drops").delete().eq("id", id);
    throw new AppError("internal", "The drop could not be made.", undefined, { cause: linked.error });
  }
  return id;
}

export async function cancelDrop(admin: SupabaseClient, brandId: string, dropId: string): Promise<boolean> {
  const answer = await admin.from("storefront_drops").update({ status: "cancelled", closed_at: new Date().toISOString() }).eq("id", dropId).eq("brand_id", brandId).eq("status", "scheduled").gt("opens_at", new Date().toISOString()).select("id");
  if (answer.error) throw new AppError("internal", "The drop could not be cancelled.", undefined, { cause: answer.error });
  return (answer.data ?? []).length > 0;
}

/** Closes every drop whose window has passed. Answers the drops closed. */
export async function closeDueDrops(admin: SupabaseClient, now: Date): Promise<readonly Drop[]> {
  const answer = await admin.from("storefront_drops").update({ status: "closed", closed_at: now.toISOString() }).eq("status", "scheduled").lte("closes_at", now.toISOString()).select(DROP_COLUMNS);
  return rows(answer, toDrop, "The drops");
}

/** Pieces sold per listing in a set of drops (paid or not yet settled payments count once paid). */
export async function soldInDrops(client: SupabaseClient, dropIds: readonly string[]): Promise<ReadonlyMap<string, number>> {
  if (dropIds.length === 0) return new Map();
  const answer = await client.from("shop_orders").select("drop_id, qty, order_payments!inner(status)").in("drop_id", [...dropIds]).in("order_payments.status", ["paid", "fulfilled"]);
  const parsed = rows(answer, (row) => z.object({ drop_id: z.uuid(), qty: z.number().int() }).loose().parse(row), "The pre-orders");
  const sold = new Map<string, number>();
  for (const row of parsed) sold.set(row.drop_id, (sold.get(row.drop_id) ?? 0) + row.qty);
  return sold;
}

/** Opens a shopper's order and its card payment (`open_shop_order`). A refusal comes back in the shopper's words. */
export async function openShopOrder(admin: SupabaseClient, body: ShopOrderBody & Readonly<{ accessHash: string }>): Promise<OpenedShopOrder> {
  const { data, error } = await admin.rpc("open_shop_order", {
    p_listing_id: body.listingId,
    p_size: body.size,
    p_qty: body.qty,
    p_name: body.name === "" ? null : body.name,
    p_number: body.number === "" ? null : body.number,
    p_email: body.email,
    p_country: body.country,
    p_size_confirmed: body.sizeConfirmed,
    p_returns_accepted: body.returnsAccepted,
    p_access_hash: body.accessHash,
  });
  if (error) {
    const hint = (error as { hint?: string }).hint ?? "";
    const words = SHOP_REFUSALS[hint] ?? (hint === "invalid_input" ? error.message : null);
    if (words) throw new AppError("conflict", words);
    throw new AppError("internal", "The order could not be opened.", undefined, { cause: error });
  }
  const row = z
    .array(z.object({ shop_order_id: z.uuid(), payment_id: z.uuid(), amount_minor: z.coerce.number().int(), currency: z.enum(["GBP", "AUD"]), brand_id: z.uuid() }))
    .parse(data)[0];
  if (!row) throw new AppError("internal", "The order could not be opened.");
  return { shopOrderId: row.shop_order_id, paymentId: row.payment_id, amountMinor: row.amount_minor, currency: row.currency, brandId: row.brand_id };
}

export const shopOrderById = async (admin: SupabaseClient, id: string): Promise<ShopOrder | null> =>
  one(await admin.from("shop_orders").select(SHOP_ORDER_COLUMNS).eq("id", id).maybeSingle(), toShopOrder, "The order");

export const shopOrderByPayment = async (admin: SupabaseClient, paymentId: string): Promise<ShopOrder | null> =>
  one(await admin.from("shop_orders").select(SHOP_ORDER_COLUMNS).eq("payment_id", paymentId).maybeSingle(), toShopOrder, "The order");

/** The brand's paid storefront orders, newest first. A checkout never finished is not an order. */
export const shopOrdersOfBrand = async (client: SupabaseClient, brandId: string, limit = 50): Promise<readonly ShopOrder[]> =>
  rows(
    await client
      .from("shop_orders")
      .select(`${SHOP_ORDER_COLUMNS}, order_payments!inner(status)`)
      .eq("brand_id", brandId)
      .in("order_payments.status", ["paid", "fulfilled", "refunded"])
      .order("created_at", { ascending: false })
      .limit(limit),
    toShopOrder,
    "The orders",
  );

export const shopOrdersOfBatch = async (admin: SupabaseClient, batchId: string): Promise<readonly ShopOrder[]> =>
  rows(await admin.from("shop_orders").select(SHOP_ORDER_COLUMNS).eq("batch_id", batchId), toShopOrder, "The orders");

export const batchesOfBrand = async (client: SupabaseClient, brandId: string, limit = 30): Promise<readonly Batch[]> =>
  rows(await client.from("storefront_batches").select(BATCH_COLUMNS).eq("brand_id", brandId).order("created_at", { ascending: false }).limit(limit), toBatch, "The batches");

export const openBatches = async (admin: SupabaseClient, brandId?: string): Promise<readonly Batch[]> => {
  const query = admin.from("storefront_batches").select(BATCH_COLUMNS).eq("status", "open").order("created_at");
  return rows(await (brandId ? query.eq("brand_id", brandId) : query), toBatch, "The batches");
};

/** The listings with paid orders waiting outside any drop: the made-to-order sales of the week. */
export async function listingsWaiting(admin: SupabaseClient, brandId?: string): Promise<readonly string[]> {
  const query = admin.from("shop_orders").select("listing_id, order_payments!inner(status)").is("batch_id", null).is("drop_id", null).not("listing_id", "is", null).in("order_payments.status", ["paid", "fulfilled"]);
  const parsed = rows(await (brandId ? query.eq("brand_id", brandId) : query), (row) => z.object({ listing_id: z.uuid() }).loose().parse(row).listing_id, "The orders");
  return [...new Set(parsed)];
}

export async function cutBatch(admin: SupabaseClient, listingId: string, dropId: string | null, cutoff: Date): Promise<string | null> {
  const { data, error } = await admin.rpc("cut_storefront_batch", { p_listing_id: listingId, p_drop_id: dropId, p_cutoff: cutoff.toISOString() });
  if (error) throw new AppError("internal", "The batch could not be cut.", undefined, { cause: error });
  return z.uuid().nullable().parse(data);
}

export async function openBatchPayment(admin: SupabaseClient, batchId: string, userId: string, line: Record<string, unknown>): Promise<string> {
  const { data, error } = await admin.rpc("open_storefront_batch_payment", { p_batch_id: batchId, p_user_id: userId, p_line: line });
  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "42501" || code === "P0001" || code === "22023") throw new AppError("conflict", error.message);
    throw new AppError("internal", "The batch could not be paid for.", undefined, { cause: error });
  }
  return z.uuid().parse(data);
}

export async function settleBatch(admin: SupabaseClient, batchId: string, status: "sent" | "refused", orderId: string | null, message: string | null): Promise<void> {
  const { error } = await admin.rpc("settle_storefront_batch", { p_batch_id: batchId, p_status: status, p_order_id: orderId, p_message: message });
  if (error) throw new AppError("internal", "The batch could not be settled.", undefined, { cause: error });
}

/** The role a person holds in a brand, or null when they hold none. */
export async function roleOf(admin: SupabaseClient, brandId: string, userId: string): Promise<string | null> {
  const { data, error } = await admin.from("memberships").select("role").eq("brand_id", brandId).eq("user_id", userId).maybeSingle();
  if (error) fail(error, "The membership");
  return data ? z.object({ role: z.string() }).parse(data).role : null;
}
