import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listProducts } from "@/lib/brand-runs/service";
import { loadOrderProducts } from "@/lib/make/server";
import { AppError } from "@/lib/server/core/errors";
import { toCsv } from "./csv";
import { LISTING_COLUMNS, ORDER_COLUMNS, toListing, toOrder } from "./db";
import { productRows, orderRows, PRODUCT_HEADER, ORDER_HEADER } from "./export-rows";

/**
 * The CSV exports (plan v6 C4, decision 0155), read through the member's own session, so the database's own rules
 * decide what they may see. The rows are shaped by `export-rows.ts`, which is tested.
 */

const READ_FAILED = "The export could not be read. Try again.";

export async function productsCsv(client: SupabaseClient, brandId: string, _userId: string): Promise<string> {
  const [products, orderProducts, listings] = await Promise.all([
    listProducts(client, brandId),
    loadOrderProducts(client, brandId, "GBP"),
    client.from("channel_listings").select(LISTING_COLUMNS).eq("brand_id", brandId).limit(2000),
  ]);
  if (listings.error) throw new AppError("internal", READ_FAILED, undefined, { cause: listings.error });
  const sizes = new Map(orderProducts.map((one) => [one.productId, one.sizes]));
  return toCsv(PRODUCT_HEADER, productRows(products.map((product) => ({ productId: product.id, name: product.name, stage: product.stage, sizes: sizes.get(product.id) ?? [] })), (listings.data ?? []).map(toListing)));
}

export async function ordersCsv(client: SupabaseClient, brandId: string): Promise<string> {
  const [orders, products] = await Promise.all([client.from("channel_orders").select(ORDER_COLUMNS).eq("brand_id", brandId).order("received_at", { ascending: false }).limit(5000), listProducts(client, brandId)]);
  if (orders.error) throw new AppError("internal", READ_FAILED, undefined, { cause: orders.error });
  return toCsv(ORDER_HEADER, orderRows((orders.data ?? []).map(toOrder), products.map((product) => ({ productId: product.id, name: product.name }))));
}
