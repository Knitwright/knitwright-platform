import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { loadRunContext } from "@/lib/brand-runs/run-context";
import type { Stage } from "@/lib/brand-runs/stage";
import { baseArticleForType } from "@/lib/catalogue";
import { getBaseArticle } from "@/lib/catalogue/read";
import { sizeChart, type SizeChart } from "@/lib/home/article-view";
import { ladderForArticle, loadFactoryFacts } from "@/lib/order-desk/server";
import { renderOf } from "@/lib/products/render";
import { adminClient } from "@/lib/server/deps";
import { listPalettes } from "@/lib/brand-studio/service";
import { dropsOfListing, publishedListings, readListing, readStorefront, storefrontBySlug, listingById } from "./db";
import type { Drop } from "./drops";
import { listingHealth, type HealthLine } from "./health";
import { newListing, type Currency, type Listing, type MediaItem } from "./listing";
import { fileIdsOf, mediaPool, poolFromHandOffs, stillInPool } from "./media";
import { gpsrRows, type GpsrRow } from "./policy";
import { orderSizes, priceRows, sizesOf, unitCost, type PriceRow, type UnitCost } from "./pricing";
import type { Storefront } from "./rows";

/**
 * The storefront code joined to the product, the design's run context, the factory's ladder, the hand-offs and the
 * file store (plan v6 C3, decision 0154). No rules live here: they are in the tested files beside it, and the
 * database and browser tests cover these joins.
 */

export interface ProductFacts {
  readonly id: string;
  readonly name: string;
  readonly stage: Stage;
  readonly projectId: string;
}

export interface EditorData {
  readonly product: ProductFacts;
  readonly listing: Listing;
  readonly sizes: readonly string[];
  readonly fabrics: readonly string[];
  readonly hasRelease: boolean;
  readonly productionClass: "A" | "B" | null;
  readonly cost: UnitCost;
  readonly rows: readonly PriceRow[];
  readonly storefront: Storefront | null;
  readonly gpsr: readonly GpsrRow[];
  readonly pool: readonly MediaItem[];
  /** A picture address for every pool item that has one. */
  readonly sources: Readonly<Record<string, string>>;
  readonly health: readonly HealthLine[];
}

const productRow = z.object({ id: z.uuid(), name: z.string(), stage: z.enum(["idea", "sample", "run"]), project_id: z.uuid() });

export async function readProduct(client: SupabaseClient, brandId: string, productId: string): Promise<ProductFacts | null> {
  if (!z.uuid().safeParse(productId).success) return null;
  const { data } = await client.from("brand_products").select("id, name, stage, project_id").eq("brand_id", brandId).eq("id", productId).maybeSingle();
  const row = productRow.nullable().catch(null).parse(data);
  return row ? { id: row.id, name: row.name, stage: row.stage, projectId: row.project_id } : null;
}

/** Short-lived links for the pool's files, made with the server's key for this brand's files only. */
export async function fileSources(admin: SupabaseClient, brandId: string, fileIds: readonly string[]): Promise<Record<string, string>> {
  if (fileIds.length === 0) return {};
  const { data } = await admin.from("files").select("id, bucket, path").eq("brand_id", brandId).in("id", [...fileIds]);
  const files = z.array(z.object({ id: z.uuid(), bucket: z.string(), path: z.string() })).catch([]).parse(data ?? []);
  const out: Record<string, string> = {};
  for (const bucket of new Set(files.map((file) => file.bucket))) {
    const inBucket = files.filter((file) => file.bucket === bucket);
    const signed = await admin.storage.from(bucket).createSignedUrls(inBucket.map((file) => file.path), 600);
    for (const [index, link] of (signed.data ?? []).entries()) if (link.signedUrl) out[`flow-${inBucket[index]!.id}`] = link.signedUrl;
  }
  return out;
}

async function handOffsOf(client: SupabaseClient, brandId: string, projectId: string): Promise<readonly MediaItem[]> {
  const { data } = await client.from("flow_listings").select("payload").eq("brand_id", brandId).order("created_at", { ascending: false }).limit(50);
  return poolFromHandOffs((data ?? []).map((row) => (row as { payload: unknown }).payload), projectId);
}

async function factoryFacts(currency: Currency, garmentType: string) {
  const facts = await loadFactoryFacts(currency);
  const factory = facts.snapshot?.factory ?? null;
  return { ladder: ladderForArticle(facts.snapshot, garmentType), factory: factory ? { name: factory.name, country: `${factory.city}, ${factory.country}` } : null };
}

/** Everything the listing editor shows for one product of the brand, or null when the brand has no such product. */
export async function loadListingEditor(client: SupabaseClient, brand: Readonly<{ id: string; name: string }>, productId: string): Promise<EditorData | null> {
  const product = await readProduct(client, brand.id, productId);
  if (product === null) return null;
  const [saved, storefront, context, handOffs] = await Promise.all([
    readListing(client, brand.id, product.id),
    readStorefront(client, brand.id),
    loadRunContext(client, brand.id, product.projectId),
    handOffsOf(client, brand.id, product.projectId),
  ]);
  const listing = saved ?? { ...newListing({ brandId: brand.id, productId: product.id, title: product.name }), fabricKey: context.fabrics[0] ?? null };
  const { ladder, factory } = await factoryFacts(listing.currency, context.garmentType);
  const render = renderOf(context.garmentType);
  const pool = mediaPool(handOffs, render !== null);
  const sources = { ...(render ? { "render-front": render.src } : {}), ...(await fileSources(adminClient(), brand.id, fileIdsOf(pool))) };
  const sizes = sizesOf(context.sizeRun);
  const cost = unitCost(ladder, listing.currency);
  const rows = priceRows(sizes, listing.prices, cost);
  const current = { ...listing, media: stillInPool(listing.media, pool) };
  const facts = { rows, stage: product.stage, hasRelease: context.releases.length > 0, productionClass: context.productionClass, euResponsiblePerson: storefront?.euResponsiblePerson ?? null, storefrontLive: storefront?.status === "live" };
  return {
    product,
    listing: current,
    sizes,
    fabrics: context.fabrics,
    hasRelease: facts.hasRelease,
    productionClass: context.productionClass,
    cost,
    rows,
    storefront,
    gpsr: gpsrRows({ factory, euResponsiblePerson: storefront?.euResponsiblePerson ?? null }),
    pool,
    sources,
    health: listingHealth(current, facts),
  };
}

/** The newest frozen release of the product's design: what a published listing is made from. */
export async function newestRelease(client: SupabaseClient, brandId: string, projectId: string): Promise<string | null> {
  const context = await loadRunContext(client, brandId, projectId);
  return context.releases[0]?.id ?? null;
}

// ---------------------------------------------------------------------------------------------
// The public storefront. Read with the server's key, and only what a live storefront publishes.

export interface ShopCard {
  readonly listing: Listing;
  readonly image: Readonly<{ src: string; aiLabel: string | null }> | null;
}

export interface Shop {
  readonly storefront: Storefront;
  /** The brand's first colour, for the storefront's accent, or null when it has none. */
  readonly accent: string | null;
}

async function shopOf(slug: string): Promise<Shop | null> {
  const storefront = await storefrontBySlug(adminClient(), slug);
  if (storefront === null || storefront.status !== "live") return null;
  const palettes = await listPalettes(adminClient(), storefront.brandId).catch(() => []);
  const accent = palettes[0]?.colours[0]?.hex ?? null;
  return { storefront, accent: accent && /^#[0-9a-f]{6}$/.test(accent) ? accent : null };
}

async function garmentTypeOf(admin: SupabaseClient, productId: string): Promise<string | null> {
  const { data } = await admin.from("brand_products").select("projects(garment_type)").eq("id", productId).maybeSingle();
  return z.object({ projects: z.object({ garment_type: z.string() }) }).nullable().catch(null).parse(data)?.projects.garment_type ?? null;
}

async function imagesOf(admin: SupabaseClient, listing: Listing): Promise<readonly Readonly<{ id: string; src: string; label: string; aiLabel: string | null }>[]> {
  const type = await garmentTypeOf(admin, listing.productId);
  const render = renderOf(type);
  const links = await fileSources(admin, listing.brandId, fileIdsOf(listing.media));
  return listing.media.flatMap((item) => {
    const src = item.source === "render" ? render?.src : links[item.id];
    return src ? [{ id: item.id, src, label: item.label, aiLabel: item.aiLabel }] : [];
  });
}

export async function loadShop(slug: string): Promise<(Shop & Readonly<{ cards: readonly ShopCard[] }>) | null> {
  const shop = await shopOf(slug);
  if (shop === null) return null;
  const listings = await publishedListings(adminClient(), shop.storefront.brandId);
  const cards = await Promise.all(
    listings.map(async (listing) => {
      const first = (await imagesOf(adminClient(), { ...listing, media: listing.media.slice(0, 1) }))[0];
      return { listing, image: first ? { src: first.src, aiLabel: first.aiLabel } : null };
    }),
  );
  return { ...shop, cards };
}

export interface ShopProduct extends Shop {
  readonly listing: Listing;
  readonly images: Awaited<ReturnType<typeof imagesOf>>;
  readonly sizes: readonly string[];
  readonly chart: SizeChart | null;
  readonly drops: readonly Drop[];
}

/** One product page of a live storefront, or null when the listing is not on sale there. */
export async function loadShopProduct(slug: string, listingId: string): Promise<ShopProduct | null> {
  if (!z.uuid().safeParse(listingId).success) return null;
  const shop = await shopOf(slug);
  if (shop === null) return null;
  const admin = adminClient();
  const listing = await listingById(admin, listingId);
  if (listing === null || listing.brandId !== shop.storefront.brandId || listing.status !== "published" || listing.channel !== "storefront") return null;
  const type = await garmentTypeOf(admin, listing.productId);
  const code = type ? baseArticleForType(type) : undefined;
  const article = code ? await getBaseArticle(admin, code).catch(() => null) : null;
  const [images, drops] = await Promise.all([imagesOf(admin, listing), dropsOfListing(admin, listing.id)]);
  const sizes = orderSizes(Object.keys(listing.prices));
  return { ...shop, listing, images, sizes, chart: article && listing.showSizeTable ? sizeChart(article) : null, drops };
}

export const loadStorefront = (client: SupabaseClient, brandId: string) => readStorefront(client, brandId);
