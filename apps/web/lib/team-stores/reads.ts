import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { kitFromRow, type Kit } from "@/lib/clubs/kit";
import { AppError } from "@/lib/server/core/errors";
import { PURCHASE_SELECT, STORE_COLUMNS, toPurchase, toStore, type StorePurchase, type TeamStore } from "./model";

/**
 * The team store reads (plan v6 C2, decision 0153). A club's own reads go through the member's client, so row level
 * security decides what is seen; the public pages read through the server's key and only the columns a stranger
 * may see: a store's title, prices, sizes and dates, the club's name, kit colours and crest, its page's contact
 * line. Never a buyer's name, email or shirt name.
 */

const fail = (error: unknown): never => {
  throw new AppError("internal", "The team stores could not be read.", undefined, { cause: error });
};

export async function listStores(client: SupabaseClient, brandId: string, projectId: string | null = null): Promise<readonly TeamStore[]> {
  let query = client.from("team_stores").select(STORE_COLUMNS).eq("brand_id", brandId).order("created_at", { ascending: false }).limit(100);
  if (projectId !== null) query = query.eq("project_id", projectId);
  const { data, error } = await query;
  if (error) fail(error);
  return (data ?? []).map(toStore);
}

export async function listPurchases(client: SupabaseClient, storeIds: readonly string[]): Promise<ReadonlyMap<string, readonly StorePurchase[]>> {
  const byStore = new Map<string, StorePurchase[]>();
  if (storeIds.length === 0) return byStore;
  const { data, error } = await client.from("team_store_orders").select(`store_id, ${PURCHASE_SELECT}`).in("store_id", [...storeIds]).order("created_at");
  if (error) fail(error);
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const id = String(row.store_id);
    byStore.set(id, [...(byStore.get(id) ?? []), toPurchase(row)]);
  }
  return byStore;
}

export interface ClubPage {
  readonly slug: string;
  readonly contact: string;
  readonly published: boolean;
}

const pageRow = z.object({ slug: z.string(), contact: z.string(), published: z.boolean() });

export async function readClubPage(client: SupabaseClient, brandId: string): Promise<ClubPage | null> {
  const { data, error } = await client.from("club_pages").select("slug, contact, published").eq("brand_id", brandId).maybeSingle();
  if (error) fail(error);
  return data === null ? null : pageRow.parse(data);
}

/** What a stranger may read about a club: its name, kit and page. */
export interface PublicClub {
  readonly brandId: string;
  readonly name: string;
  readonly kit: Kit;
  readonly page: ClubPage | null;
}

async function publicClub(admin: SupabaseClient, brandId: string): Promise<PublicClub> {
  const [brand, kit, page] = await Promise.all([
    admin.from("brands").select("name").eq("id", brandId).single(),
    admin.from("club_kits").select("primary_colour, secondary_colour, accent_colour, crest_file_id, sponsors, name_font, number_font").eq("brand_id", brandId).maybeSingle(),
    admin.from("club_pages").select("slug, contact, published").eq("brand_id", brandId).maybeSingle(),
  ]);
  if (brand.error || kit.error || page.error) fail(brand.error ?? kit.error ?? page.error);
  return {
    brandId,
    name: String((brand.data as { name: string }).name),
    kit: kitFromRow(kit.data),
    page: page.data === null ? null : pageRow.parse(page.data),
  };
}

/** A store by its short link, with its club, for the public store page. Null when there is no such store. */
export async function readPublicStore(admin: SupabaseClient, code: string): Promise<Readonly<{ store: TeamStore; club: PublicClub }> | null> {
  const { data, error } = await admin.from("team_stores").select(STORE_COLUMNS).eq("code", code).maybeSingle();
  if (error) fail(error);
  if (data === null) return null;
  const store = toStore(data);
  return { store, club: await publicClub(admin, store.brandId) };
}

/** A published club page by its address, with the club's stores that are open or about to open. */
export async function readPublicClubPage(admin: SupabaseClient, slug: string, now: Date): Promise<Readonly<{ club: PublicClub; stores: readonly TeamStore[] }> | null> {
  const { data, error } = await admin.from("club_pages").select("brand_id").eq("slug", slug).eq("published", true).maybeSingle();
  if (error) fail(error);
  if (data === null) return null;
  const brandId = String((data as { brand_id: string }).brand_id);
  const stores = await admin.from("team_stores").select(STORE_COLUMNS).eq("brand_id", brandId).eq("status", "open").gt("closes_at", now.toISOString()).order("closes_at").limit(20);
  if (stores.error) fail(stores.error);
  return { club: await publicClub(admin, brandId), stores: (stores.data ?? []).map(toStore) };
}

/** The paid state of one buyer's payment, for their return page. Only a team store payment of this store. */
export async function readBuyerPayment(admin: SupabaseClient, storeId: string, paymentId: string): Promise<Readonly<{ status: string; amountMinor: number; refundedMinor: number }> | null> {
  if (!z.uuid().safeParse(paymentId).success) return null;
  const { data, error } = await admin.from("team_store_orders").select("order_payments(status, amount_minor, refunded_minor)").eq("store_id", storeId).eq("payment_id", paymentId).maybeSingle();
  if (error) fail(error);
  const payment = (data as { order_payments: { status: string; amount_minor: number; refunded_minor: number } | null } | null)?.order_payments;
  return payment ? { status: payment.status, amountMinor: Number(payment.amount_minor), refundedMinor: Number(payment.refunded_minor) } : null;
}
