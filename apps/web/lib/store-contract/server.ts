import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBaseArticle } from "@/lib/catalogue";
import { kitFromRow } from "@/lib/clubs/kit";
import { articleCodeSchema } from "@/lib/factory/schemas";
import { factoryStore } from "@/lib/factory/server";
import { loadProductionSettings } from "@/lib/factory/production-settings";
import { priceBookOf, type PriceBook } from "@/lib/home/book";
import { adminClient } from "@/lib/server/deps";
import {
  dropsPayload,
  listingsPayload,
  manifestPayload,
  productsPayload,
  teamStoresPayload,
  type DropsPayload,
  type ListingsPayload,
  type ManifestPayload,
  type ProductsPayload,
  type TeamStoresPayload,
} from "./contract";
import type { DeliveryInput } from "./delivery";
import type { DropRow } from "./drops";
import { mediaForDesign, type ListingRow } from "./listings";
import { storePersonalisation, type NumberRule, type PersonalisationZone } from "./personalisation";
import type { ArticleFacts, ProductInput, Publication, StoreMediaItem } from "./product";
import type { ListQuery, ProductsQuery } from "./schemas";
import type { TeamStoreInput } from "./team-store";

/**
 * The only file of this directory that knows about the database (plan v5 O2).
 *
 * Every rule of the contract is pure and lives beside this; this reads the rows and hands them over.
 * It reads with the server's own key, because these endpoints answer a service across brands, which
 * no session may do — and the door in front of them is the signed token, not a session
 * (`admit.ts`). Nothing here writes: a collection drop and a launch listing are append-only records
 * of a hand-off, and saying one has been collected is a write this contract does not make.
 */

const SECRET_KEY = "STORE_SERVICE_TOKEN";

/** The shared secret, read straight from the process environment as the weekly cut's reads its own. */
export const storeSecret = (): string | undefined => process.env[SECRET_KEY];

const LIMIT_DEFAULT = 50;

const rowsOf = async (client: SupabaseClient, table: string, columns: string, query: ListQuery): Promise<readonly Record<string, unknown>[]> => {
  let select = client.from(table).select(columns).order("created_at", { ascending: false }).limit(query.limit ?? LIMIT_DEFAULT);
  if (query.brandId !== undefined) select = select.eq("brand_id", query.brandId);
  const { data, error } = await select;
  if (error) throw error;
  return (data ?? []) as unknown as Record<string, unknown>[];
};

const toDropRow = (row: Record<string, unknown>): DropRow => ({
  dropId: String(row.id),
  brandId: String(row.brand_id),
  collectionId: String(row.collection_id),
  version: Number(row.version),
  createdAt: String(row.created_at),
  payload: row.payload,
});

const toListingRow = (row: Record<string, unknown>): ListingRow => ({
  listingId: String(row.id),
  brandId: String(row.brand_id),
  launchProjectId: String(row.launch_project_id),
  createdAt: String(row.created_at),
  collectedAt: row.collected_at === null || row.collected_at === undefined ? null : String(row.collected_at),
  payload: row.payload,
});

export async function serveManifest(at: Date = new Date()): Promise<ManifestPayload> {
  return manifestPayload(at);
}

export async function serveDrops(query: ListQuery, at: Date = new Date()): Promise<DropsPayload> {
  const rows = await rowsOf(adminClient(), "collection_drops", "id, brand_id, collection_id, version, payload, created_at", query);
  return dropsPayload(rows.map(toDropRow), at);
}

export async function serveListings(query: ListQuery, at: Date = new Date()): Promise<ListingsPayload> {
  const rows = await rowsOf(adminClient(), "flow_listings", "id, brand_id, launch_project_id, payload, created_at, collected_at", query);
  return listingsPayload(rows.map(toListingRow), at);
}

/** The personalisation rows, which are the same for every product and every club. */
async function personalisationOf(client: SupabaseClient) {
  const [zones, numbers] = await Promise.all([
    client.from("shirt_zone_limits").select("zone, label, max_characters, rule_id, note"),
    client.from("sport_number_rules").select("sport, label, lowest, highest, leading_zero_allowed, rule_id, note"),
  ]);
  const zoneRows: PersonalisationZone[] = (zones.data ?? []).map((row) => ({
    zone: String(row.zone),
    label: String(row.label),
    maxCharacters: Number(row.max_characters),
    ruleId: String(row.rule_id),
    note: String(row.note),
  }));
  const numberRows: NumberRule[] = (numbers.data ?? []).map((row) => ({
    sport: String(row.sport),
    label: String(row.label),
    lowest: Number(row.lowest),
    highest: Number(row.highest),
    leadingZeroAllowed: Boolean(row.leading_zero_allowed),
    ruleId: String(row.rule_id),
    note: String(row.note),
  }));
  return { rules: storePersonalisation(zoneRows, numberRows), numberRows };
}

/** Which article a product is made of, and what the catalogue holds about it. */
async function articleOf(client: SupabaseClient, code: string | null): Promise<ArticleFacts | null> {
  if (code === null || !articleCodeSchema.safeParse(code).success) return null;
  const article = await getBaseArticle(client, code);
  if (article === null) return null;
  return {
    code: article.code,
    name: article.name,
    productionClass: article.productionClass,
    sizes: article.sizeRange,
    sampleSize: article.sampleSize,
    poms: article.poms,
  };
}

type DateContext = Readonly<{ timeZone: string; cutoff: DeliveryInput["cutoff"]; qcDays: number | null; freightDays: number | null }>;

/** The figures the dates are worked out from, read once for the whole answer rather than per product. */
async function dateContext(country: string | undefined): Promise<DateContext> {
  const store = factoryStore();
  const [factories, rules, settings] = await Promise.all([store.listFactories(), store.listCountryRules(), loadProductionSettings(adminClient())]);
  const rule = rules.find((one) => one.country === country) ?? rules.find((one) => one.sellingEnabled) ?? null;
  return { timeZone: factories[0]?.timeZone ?? "UTC", cutoff: settings.cutoff, qcDays: settings.qcDays, freightDays: rule?.freightDays ?? null };
}

/** The dates for one article. The lead time is the factory's own, and a missing one stays missing. */
const deliveryOf = (context: DateContext, book: PriceBook, articleCode: string | null, at: Date): DeliveryInput => ({
  orderAt: at,
  productionClass: "A",
  timeZone: context.timeZone,
  cutoff: context.cutoff,
  leadTimeDays: (articleCode === null ? undefined : book.capability(articleCode))?.leadTimeDays ?? null,
  qcDays: context.qcDays,
  freightDays: context.freightDays,
});

/** Every hand-off that names a product, and what each one said about it. */
function publicationsOf(drops: DropsPayload, listings: ListingsPayload, productId: string, projectId: string) {
  const fromDrops = drops.data.drops.flatMap((drop) =>
    drop.payload.styles
      .filter((style) => style.productId === productId)
      .map((style) => ({
        publication: { via: "collection-drop", collectionId: drop.collectionId, dropId: drop.dropId, dropVersion: drop.version, at: drop.handedOverAt } as Publication,
        style,
      })),
  );
  const fromListings = listings.data.listings
    .filter((listing) => listing.payload.designProjectId === projectId)
    .map((listing) => ({ via: "flow-listing", listingId: listing.listingId, launchProjectId: listing.launchProjectId, at: listing.handedOverAt }) as Publication);
  return { fromDrops, publications: [...fromDrops.map((one) => one.publication), ...fromListings] };
}

export async function serveProducts(query: ProductsQuery, at: Date = new Date()): Promise<ProductsPayload> {
  const client = adminClient();
  const all = { limit: 200, ...(query.brandId === undefined ? {} : { brandId: query.brandId }) };
  const [drops, listings, { rules }, book, dates, products] = await Promise.all([
    serveDrops(all, at),
    serveListings(all, at),
    personalisationOf(client),
    priceBookOf(factoryStore()),
    dateContext(query.country),
    rowsOf(client, "brand_products", "id, brand_id, project_id, name, stage, design_version, created_at", { limit: query.limit, ...(query.brandId === undefined ? {} : { brandId: query.brandId }) }),
  ]);

  const inputs: ProductInput[] = [];
  for (const row of products) {
    const productId = String(row.id);
    const projectId = String(row.project_id);
    const { fromDrops, publications } = publicationsOf(drops, listings, productId, projectId);
    if (publications.length === 0) continue;
    const articleCode = fromDrops.map((one) => one.style.articleCode).find((code) => code !== null) ?? null;
    const media: StoreMediaItem[] = mediaForDesign(listings.data.listings, projectId);
    inputs.push({
      productId,
      brandId: String(row.brand_id),
      designProjectId: projectId,
      designVersion: Number(row.design_version),
      name: String(row.name),
      stage: row.stage as ProductInput["stage"],
      publications,
      article: await articleOf(client, articleCode),
      ladder: articleCode === null ? [] : book.source(articleCode).ladder,
      planned: fromDrops.flatMap((one) => one.style.sizes.map((size) => ({ size: size.size, targetQty: size.targetQty }))),
      media,
      delivery: deliveryOf(dates, book, articleCode, at),
      personalisation: rules,
    });
  }
  return productsPayload(inputs, at);
}

/** A club's own kit, seasons and sport, with the design it has listed as a product. */
export async function serveTeamStores(query: ListQuery, at: Date = new Date()): Promise<TeamStoresPayload> {
  const client = adminClient();
  const { rules, numberRows } = await personalisationOf(client);
  let kits = client.from("club_kits").select("brand_id, primary_colour, secondary_colour, accent_colour, crest_file_id, sponsors, name_font, number_font").limit(query.limit);
  if (query.brandId !== undefined) kits = kits.eq("brand_id", query.brandId);
  const { data, error } = await kits;
  if (error) throw error;

  const inputs = await Promise.all((data ?? []).map((row) => teamStoreOf(client, row as Record<string, unknown>, rules, numberRows)));
  return teamStoresPayload(inputs, at);
}

async function teamStoreOf(
  client: SupabaseClient,
  row: Record<string, unknown>,
  rules: TeamStoreInput["personalisation"],
  numberRows: readonly NumberRule[],
): Promise<TeamStoreInput> {
  const brandId = String(row.brand_id);
  const [brand, seasons, links, products] = await Promise.all([
    client.from("brands").select("name").eq("id", brandId).maybeSingle(),
    client.from("club_seasons").select("id, name, starts_on, ends_on").eq("brand_id", brandId).order("created_at", { ascending: false }).limit(20),
    client.from("roster_signup_links").select("sport").eq("brand_id", brandId).limit(1),
    client.from("brand_products").select("project_id, name, design_version").eq("brand_id", brandId).order("created_at", { ascending: false }).limit(1),
  ]);
  const sport = links.data?.[0]?.sport === undefined ? "default" : String(links.data[0].sport);
  const product = products.data?.[0];
  return {
    brandId,
    clubName: String(brand.data?.name ?? ""),
    kit: kitFromRow(row),
    design: product === undefined ? null : { projectId: String(product.project_id), version: Number(product.design_version), name: String(product.name) },
    seasons: (seasons.data ?? []).map((season) => ({
      seasonId: String(season.id),
      name: String(season.name),
      startsOn: season.starts_on === null ? null : String(season.starts_on),
      endsOn: season.ends_on === null ? null : String(season.ends_on),
    })),
    numbers: numberRows.find((rule) => rule.sport === sport) ?? null,
    // Nothing records which base article a club's kit is made from: the kit holds colours, a crest
    // and sponsors, and "Design in Studio" copies them into a design rather than linking back. So
    // there is no size run to publish, and the payload says that rather than guessing one.
    sizes: [],
    personalisation: rules,
  };
}
