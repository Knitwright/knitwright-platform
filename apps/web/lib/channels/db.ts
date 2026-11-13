import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { refusal } from "@/lib/make/service";
import type { ChannelOrderRow, ChannelsStore, ConnectionSecret, ListingRow } from "./store";

/**
 * The channel tables through the server's key (migration 20261228050000). Every write is one of the migration's
 * functions; a refusal the database writes for a person comes back as an AppError in its words (`refusal`). The
 * database tests cover this file (`tests/integration/channels.test.ts`).
 */

type Answer<T> = Readonly<{ data: T | null; error: Readonly<{ code?: string; hint?: string | null; message: string }> | null }>;

const must = <T>(answer: Answer<T>, missing = "That shop is not connected."): T | null => {
  if (answer.error) throw refusal(answer.error, missing);
  return answer.data;
};

const flags = z.array(z.object({ code: z.string(), text: z.string() }));

const secretRow = z.object({
  id: z.uuid(),
  brand_id: z.uuid(),
  shop_domain: z.string(),
  token_ciphertext: z.string(),
  token_nonce: z.string(),
  location_id: z.string().nullable(),
  connected_by: z.uuid().nullable(),
});

const toSecret = (row: unknown): ConnectionSecret => {
  const parsed = secretRow.parse(row);
  return { id: parsed.id, brandId: parsed.brand_id, shop: parsed.shop_domain, sealed: { ciphertext: parsed.token_ciphertext, nonce: parsed.token_nonce }, locationId: parsed.location_id, connectedBy: parsed.connected_by };
};

export const LISTING_COLUMNS =
  "id, connection_id, product_id, size_label, external_product_id, external_variant_id, sku, price_minor, currency, release_id, factory_profile_id, fabric_key, flags, pushed_at, brand_products(project_id)";

const listingRow = z.object({
  id: z.uuid(),
  connection_id: z.uuid(),
  product_id: z.uuid(),
  size_label: z.string(),
  external_product_id: z.string(),
  external_variant_id: z.string(),
  sku: z.string(),
  price_minor: z.coerce.number().int(),
  currency: z.enum(["GBP", "AUD"]),
  release_id: z.uuid(),
  factory_profile_id: z.string(),
  fabric_key: z.string(),
  flags,
  pushed_at: z.string(),
  brand_products: z.object({ project_id: z.uuid() }),
});

export const toListing = (row: unknown): ListingRow => {
  const r = listingRow.parse(row);
  return {
    id: r.id,
    connectionId: r.connection_id,
    productId: r.product_id,
    projectId: r.brand_products.project_id,
    sizeLabel: r.size_label,
    externalProductId: r.external_product_id,
    externalVariantId: r.external_variant_id,
    sku: r.sku,
    priceMinor: r.price_minor,
    currency: r.currency,
    releaseId: r.release_id,
    factoryProfileId: r.factory_profile_id,
    fabricKey: r.fabric_key,
    flags: r.flags,
    pushedAt: r.pushed_at,
  };
};

export const ORDER_COLUMNS = "id, channel, external_order_id, external_line_id, order_name, product_id, size_label, pieces, state, message, order_id, received_at, tracking_synced_at";

const orderRow = z.object({
  id: z.uuid(),
  channel: z.enum(["shopify", "csv"]),
  external_order_id: z.string(),
  external_line_id: z.string(),
  order_name: z.string(),
  product_id: z.uuid(),
  size_label: z.string(),
  pieces: z.number().int(),
  state: z.enum(["received", "submitted", "refused"]),
  message: z.string().nullable(),
  order_id: z.uuid().nullable(),
  received_at: z.string(),
  tracking_synced_at: z.string().nullable(),
});

export const toOrder = (row: unknown): ChannelOrderRow => {
  const r = orderRow.parse(row);
  return { id: r.id, channel: r.channel, externalOrderId: r.external_order_id, externalLineId: r.external_line_id, orderName: r.order_name, productId: r.product_id, sizeLabel: r.size_label, pieces: r.pieces, state: r.state, message: r.message, orderId: r.order_id, receivedAt: r.received_at, trackingSyncedAt: r.tracking_synced_at };
};

const connectionRow = z.object({ id: z.uuid(), channel: z.literal("shopify"), shop_domain: z.string(), scopes: z.string(), has_location: z.boolean(), connected_by: z.uuid().nullable(), connected_at: z.string() });

export function supabaseChannels(admin: SupabaseClient): ChannelsStore {
  const rpc = async <T>(fn: string, args: Record<string, unknown>): Promise<T | null> => must<T>(await admin.rpc(fn, args));
  const secret = async (id: string | null, shop: string | null) => {
    const rows = (await rpc<unknown[]>("channel_connection_secret", { p_connection_id: id, p_channel: "shopify", p_shop: shop })) ?? [];
    return rows[0] === undefined ? null : toSecret(rows[0]);
  };

  return {
    connect: async (input) =>
      (await rpc<string>("channel_connect", { p_brand_id: input.brandId, p_user_id: input.userId, p_channel: "shopify", p_shop: input.shop, p_ciphertext: input.sealed.ciphertext, p_nonce: input.sealed.nonce, p_scopes: input.scopes }))!,
    setLocation: async (connectionId, locationId) => {
      await rpc("channel_set_location", { p_connection_id: connectionId, p_location_id: locationId });
    },
    disconnect: async (brandId, userId, connectionId) => {
      await rpc("channel_disconnect", { p_brand_id: brandId, p_user_id: userId, p_connection_id: connectionId });
    },
    uninstalled: async (shop) => (await rpc<boolean>("channel_uninstalled", { p_channel: "shopify", p_shop: shop })) === true,
    connectionsOf: async (brandId, userId) =>
      ((await rpc<unknown[]>("channel_connections_of", { p_brand_id: brandId, p_user_id: userId })) ?? []).map((row) => {
        const r = connectionRow.parse(row);
        return { id: r.id, channel: r.channel, shop: r.shop_domain, scopes: r.scopes, hasLocation: r.has_location, connectedBy: r.connected_by, connectedAt: r.connected_at };
      }),
    secretById: (id) => secret(id, null),
    secretByShop: (shop) => secret(null, shop),
    recordListing: async (brandId, userId, l) =>
      (await rpc<string>("channel_record_listing", {
        p_brand_id: brandId,
        p_user_id: userId,
        p_connection_id: l.connectionId,
        p_product_id: l.productId,
        p_size_label: l.sizeLabel,
        p_external_product_id: l.externalProductId,
        p_external_variant_id: l.externalVariantId,
        p_sku: l.sku,
        p_price_minor: l.priceMinor,
        p_currency: l.currency,
        p_release_id: l.releaseId,
        p_factory_profile_id: l.factoryProfileId,
        p_fabric_key: l.fabricKey,
        p_flags: l.flags,
      }))!,
    listings: async (brandId) => (must(await admin.from("channel_listings").select(LISTING_COLUMNS).eq("brand_id", brandId).order("pushed_at", { ascending: false }).limit(1000)) ?? []).map(toListing),
    listingByVariant: async (connectionId, variantId) => {
      const row = must(await admin.from("channel_listings").select(LISTING_COLUMNS).eq("connection_id", connectionId).eq("external_variant_id", variantId).maybeSingle());
      return row === null ? null : toListing(row);
    },
    receiveLine: async (line) => {
      const rows = (await rpc<{ id: string; state: ChannelOrderRow["state"]; created: boolean }[]>("channel_receive_order_line", {
        p_brand_id: line.brandId,
        p_channel: line.channel,
        p_connection_id: line.connectionId,
        p_external_order_id: line.externalOrderId,
        p_external_line_id: line.externalLineId,
        p_order_name: line.orderName,
        p_product_id: line.productId,
        p_size_label: line.sizeLabel,
        p_pieces: line.pieces,
        p_ship_to: line.shipTo,
      })) ?? [];
      return rows[0]!;
    },
    settleLine: async (id, state, message, refs) => {
      await rpc("channel_settle_order_line", { p_id: id, p_state: state, p_message: message, p_payment_id: refs.paymentId, p_order_id: refs.orderId, p_run_id: refs.runId });
    },
    orders: async (brandId, limit) => (must(await admin.from("channel_orders").select(ORDER_COLUMNS).eq("brand_id", brandId).order("received_at", { ascending: false }).limit(limit)) ?? []).map(toOrder),
    trackingDue: async (limit) =>
      ((await rpc<{ id: string; connection_id: string; external_order_id: string; courier: string; tracking_number: string }[]>("channel_tracking_due", { p_limit: limit })) ?? []).map((row) => ({
        id: row.id,
        connectionId: row.connection_id,
        externalOrderId: row.external_order_id,
        courier: row.courier,
        trackingNumber: row.tracking_number,
      })),
    markTrackingSynced: async (id) => {
      await rpc("channel_mark_tracking_synced", { p_id: id });
    },
    redactCustomer: async (shop, orderIds) => (await rpc<number>("channel_redact_customer", { p_channel: "shopify", p_shop: shop, p_order_ids: [...orderIds] })) ?? 0,
    redactShop: async (shop) => (await rpc<number>("channel_redact_shop", { p_channel: "shopify", p_shop: shop })) ?? 0,
  };
}
