import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { SELL_CURRENCIES } from "@/lib/factory/schemas";
import { refusal } from "@/lib/make/service";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import { unitsOf } from "./board";
import type { CollectionPlan, CollectionSummary, Frame, Style } from "./types";
import { STYLE_STATUSES } from "./vocabulary";
import type { FreightRate } from "./pricing";
import type { SaveStyleBody } from "./schemas";

/**
 * The collection tables (migration 20261120040000). Reads go through the client the caller passes, which
 * in a page is the member's own, so the database's own rules decide what is seen. Every write goes
 * through the server's client and one of that migration's functions, each of which checks the person's
 * role itself; the brand and the person always come from the session.
 */

const NOT_FOUND = "That collection does not exist.";

export type Who = Readonly<{ brandId: string; userId: string }>;

const unreadable = (cause: unknown): AppError => new AppError("internal", MESSAGES.internal, undefined, { cause });

const sizeRow = z.object({ size_label: z.string(), qty: z.number().int() });

const styleRow = z.object({
  id: z.uuid(),
  frame_id: z.uuid().nullable(),
  product_id: z.uuid().nullable(),
  name: z.string(),
  status: z.enum(STYLE_STATUSES),
  colourway: z.string(),
  article_code: z.string().nullable(),
  fabric_code: z.string().nullable(),
  production_class: z.enum(["A", "B"]).nullable(),
  wholesale_minor: z.number().int().nullable(),
  rrp_minor: z.number().int().nullable(),
  wholesale_split_bp: z.number().int(),
  x: z.number().int(),
  y: z.number().int(),
  collection_style_sizes: z.array(sizeRow),
});

const frameRow = z.object({ id: z.uuid(), name: z.string(), x: z.number().int(), y: z.number().int() });

const planRow = z.object({
  id: z.uuid(),
  name: z.string(),
  destination_country: z.string(),
  currency: z.enum(SELL_CURRENCIES),
  notes: z.string(),
  updated_at: z.string(),
  collection_frames: z.array(frameRow),
  collection_styles: z.array(styleRow),
});

const summaryRow = z.object({
  id: z.uuid(),
  name: z.string(),
  destination_country: z.string(),
  currency: z.enum(SELL_CURRENCIES),
  updated_at: z.string(),
  collection_styles: z.array(z.object({ id: z.uuid(), collection_style_sizes: z.array(sizeRow) })),
});

const PLAN_SELECT = [
  "id, name, destination_country, currency, notes, updated_at",
  "collection_frames(id, name, x, y)",
  "collection_styles(id, frame_id, product_id, name, status, colourway, article_code, fabric_code, production_class, wholesale_minor, rrp_minor, wholesale_split_bp, x, y, collection_style_sizes(size_label, qty))",
].join(", ");

const SUMMARY_SELECT = "id, name, destination_country, currency, updated_at, collection_styles(id, collection_style_sizes(size_label, qty))";

const frameOf = (row: z.output<typeof frameRow>): Frame => ({ id: row.id, name: row.name, x: row.x, y: row.y });

const styleOf = (row: z.output<typeof styleRow>, projectIds: ReadonlyMap<string, string>): Style => ({
  id: row.id,
  frameId: row.frame_id,
  productId: row.product_id,
  projectId: row.product_id === null ? null : projectIds.get(row.product_id) ?? null,
  name: row.name,
  status: row.status,
  colourway: row.colourway,
  articleCode: row.article_code,
  fabricCode: row.fabric_code,
  productionClass: row.production_class,
  wholesaleMinor: row.wholesale_minor,
  rrpMinor: row.rrp_minor,
  wholesaleSplitBp: row.wholesale_split_bp,
  sizes: [...row.collection_style_sizes].sort((a, b) => a.size_label.localeCompare(b.size_label)).map((size) => ({ label: size.size_label, qty: size.qty })),
  x: row.x,
  y: row.y,
});

/** The designs behind the styles' products, so a card can link to the design and show its render. */
async function projectsOf(client: SupabaseClient, brandId: string, productIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
  if (productIds.length === 0) return new Map();
  const { data, error } = await client.from("brand_products").select("id, project_id").eq("brand_id", brandId).in("id", [...productIds]);
  if (error) throw unreadable(error);
  const rows = z.array(z.object({ id: z.uuid(), project_id: z.uuid() })).safeParse(data ?? []);
  if (!rows.success) throw unreadable(rows.error);
  return new Map(rows.data.map((row) => [row.id, row.project_id]));
}

/** One plan with its frames, its style cards and their planned sizes, or null when there is no such plan. */
export async function loadPlan(client: SupabaseClient, brandId: string, collectionId: string): Promise<CollectionPlan | null> {
  const { data, error } = await client.from("collections").select(PLAN_SELECT).eq("brand_id", brandId).eq("id", collectionId).maybeSingle();
  if (error) throw unreadable(error);
  if (data === null) return null;
  const row = planRow.safeParse(data);
  if (!row.success) throw unreadable(row.error);
  const projectIds = await projectsOf(client, brandId, row.data.collection_styles.map((style) => style.product_id).filter((id): id is string => id !== null));
  return {
    id: row.data.id,
    name: row.data.name,
    destinationCountry: row.data.destination_country,
    currency: row.data.currency,
    notes: row.data.notes,
    updatedAt: row.data.updated_at,
    frames: [...row.data.collection_frames].sort((a, b) => a.name.localeCompare(b.name)).map(frameOf),
    styles: row.data.collection_styles.map((style) => styleOf(style, projectIds)).sort((a, b) => a.name.localeCompare(b.name) || a.colourway.localeCompare(b.colourway)),
  };
}

/** Every plan of the brand, most recently changed first, with its style and unit counts. */
export async function listCollections(client: SupabaseClient, brandId: string): Promise<readonly CollectionSummary[]> {
  const { data, error } = await client.from("collections").select(SUMMARY_SELECT).eq("brand_id", brandId).order("updated_at", { ascending: false }).limit(100);
  if (error) throw unreadable(error);
  const rows = z.array(summaryRow).safeParse(data ?? []);
  if (!rows.success) throw unreadable(rows.error);
  return rows.data.map((row) => ({
    id: row.id,
    name: row.name,
    destinationCountry: row.destination_country,
    currency: row.currency,
    styles: row.collection_styles.length,
    units: row.collection_styles.reduce(
      (total, style) => total + style.collection_style_sizes.reduce((pieces, size) => pieces + size.qty, 0),
      0,
    ),
    updatedAt: row.updated_at,
  }));
}

/** The freight rows, by country. Platform data every signed-in member may read. */
export async function listFreightRates(client: SupabaseClient): Promise<readonly FreightRate[]> {
  const { data, error } = await client.from("collection_freight_rates").select("country, per_piece_minor, currency, duty_basis, rule_id, label");
  if (error) throw unreadable(error);
  const rows = z
    .array(
      z.object({
        country: z.string(),
        per_piece_minor: z.number().int().nullable(),
        currency: z.string(),
        duty_basis: z.enum(["goods", "goods_and_freight"]),
        rule_id: z.string(),
        label: z.string(),
      }),
    )
    .safeParse(data ?? []);
  if (!rows.success) throw unreadable(rows.error);
  return rows.data.map((row) => ({
    country: row.country,
    perPieceMinor: row.per_piece_minor,
    currency: row.currency,
    dutyBasis: row.duty_basis,
    ruleId: row.rule_id,
    label: row.label,
  }));
}

export const createCollection = async (
  admin: SupabaseClient,
  who: Who,
  input: Readonly<{ name: string; destinationCountry: string; currency: string }>,
): Promise<string> => {
  const { data, error } = await admin.rpc("create_collection", {
    p_brand_id: who.brandId,
    p_user_id: who.userId,
    p_name: input.name,
    p_destination: input.destinationCountry,
    p_currency: input.currency,
  });
  if (error) throw refusal(error, NOT_FOUND);
  return z.uuid().parse(data);
};

export const saveFrame = async (
  admin: SupabaseClient,
  who: Who,
  input: Readonly<{ collectionId: string; frameId: string | null; name: string; x: number; y: number }>,
): Promise<string> => {
  const { data, error } = await admin.rpc("save_collection_frame", {
    p_brand_id: who.brandId,
    p_user_id: who.userId,
    p_collection_id: input.collectionId,
    p_frame_id: input.frameId,
    p_name: input.name,
    p_x: input.x,
    p_y: input.y,
  });
  if (error) throw refusal(error, NOT_FOUND);
  return z.uuid().parse(data);
};

export const saveStyle = async (admin: SupabaseClient, who: Who, input: SaveStyleBody): Promise<string> => {
  const { data, error } = await admin.rpc("save_collection_style", {
    p_brand_id: who.brandId,
    p_user_id: who.userId,
    p_collection_id: input.collectionId,
    p_style_id: input.styleId,
    p_frame_id: input.frameId,
    p_product_id: input.productId,
    p_name: input.name,
    p_status: input.status,
    p_colourway: input.colourway,
    p_article_code: input.articleCode,
    p_fabric_code: input.fabricCode,
    p_production_class: input.productionClass,
    p_wholesale_minor: input.wholesaleMinor,
    p_rrp_minor: input.rrpMinor,
    p_wholesale_split_bp: input.wholesaleSplitBp,
    p_sizes: input.sizes,
    p_x: input.x,
    p_y: input.y,
  });
  if (error) throw refusal(error, NOT_FOUND);
  return z.uuid().parse(data);
};

export const removeStyle = async (admin: SupabaseClient, who: Who, styleId: string): Promise<void> => {
  const { error } = await admin.rpc("remove_collection_style", { p_brand_id: who.brandId, p_user_id: who.userId, p_style_id: styleId });
  if (error) throw refusal(error, NOT_FOUND);
};

export interface ExportedDrop {
  readonly id: string;
  readonly version: number;
}

/** Records an exported drop payload. The payload is built and checked by the app before it gets here. */
export const exportDrop = async (admin: SupabaseClient, who: Who, collectionId: string, payload: unknown): Promise<ExportedDrop> => {
  const { data, error } = await admin.rpc("export_collection_drop", {
    p_brand_id: who.brandId,
    p_user_id: who.userId,
    p_collection_id: collectionId,
    p_payload: payload,
  });
  if (error) throw refusal(error, NOT_FOUND);
  const [row] = z.tuple([z.object({ id: z.uuid(), version: z.number().int() })]).parse(data);
  return { id: row.id, version: row.version };
};

/** The pieces a plan holds, for the index's "units" column without reading the whole plan. */
export const unitsOfPlan = (plan: CollectionPlan): number => plan.styles.reduce((total, style) => total + unitsOf(style), 0);
