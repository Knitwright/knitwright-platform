import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { storeProductionFile } from "@/lib/storage/store";
import { DRAFT_NOTICE, writeDxf } from "./dxf/write";
import type { PatternSet } from "./set";
import {
  BLOCK_COLUMNS, REVIEW_COLUMNS, SIZE_COLUMNS, SOURCE_WORDS, blockRowSchema, reviewRowSchema, sizeRowSchema,
  type BlockDetail, type BlockSource, type BlockView, type SizeView,
} from "./records";
import { reviewLine, reviewState, type ReviewInput, type ReviewView } from "./review";
import type { Landmarks } from "./landmarks";

/**
 * The pattern library in the database. Reads go through the person's own client, so the
 * database's rules decide what they see. Every write goes through the server's client, and a
 * block with all of its sizes is stored in one step or not at all.
 */

const failIf = (error: { message: string } | null, what: string): void => {
  if (error) throw new Error(what, { cause: error });
};

const reviewOf = (row: z.output<typeof reviewRowSchema>): ReviewView => ({
  id: row.id, reviewerName: row.reviewer_name, reviewerRole: row.reviewer_role, note: row.note, reviewedOn: row.reviewed_on,
});

function viewOf(row: z.output<typeof blockRowSchema>, review: ReviewView | null): BlockView {
  return {
    id: row.id, productKey: row.product_key, wearer: row.wearer, cut: row.cut, name: row.name, kind: row.kind, version: row.version,
    source: row.source, sources: SOURCE_WORDS[row.source], sizes: row.sizes, derived: row.derived, warnings: row.warnings,
    questions: row.questions, sizeMap: row.size_map, programmeNote: row.programme_note, createdAt: row.created_at,
    state: reviewState(review), review,
  };
}

const REVIEW_PAGE = 1000;

/** Every review of the brand, newest first, read a page at a time so none is dropped for being far back. */
async function allReviews(client: SupabaseClient, brandId: string): Promise<z.output<typeof reviewRowSchema>[]> {
  const rows: z.output<typeof reviewRowSchema>[] = [];
  for (let from = 0; ; from += REVIEW_PAGE) {
    const page = await client.from("pattern_reviews").select(REVIEW_COLUMNS).eq("brand_id", brandId)
      .order("created_at", { ascending: false }).order("id", { ascending: true }).range(from, from + REVIEW_PAGE - 1);
    failIf(page.error, "The pattern reviews could not be read.");
    const got = z.array(reviewRowSchema).parse(page.data ?? []);
    rows.push(...got);
    if (got.length < REVIEW_PAGE) return rows;
  }
}

/** Every block of the brand, newest first, each with its latest review. */
export async function listBlocks(client: SupabaseClient, brandId: string): Promise<BlockView[]> {
  const blocks = await client.from("pattern_blocks").select(BLOCK_COLUMNS).eq("brand_id", brandId).order("created_at", { ascending: false }).limit(200);
  failIf(blocks.error, "The pattern library could not be read.");
  const latest = new Map<string, ReviewView>();
  for (const row of await allReviews(client, brandId)) if (!latest.has(row.block_id)) latest.set(row.block_id, reviewOf(row));
  return z.array(blockRowSchema).parse(blocks.data ?? []).map((row) => viewOf(row, latest.get(row.id) ?? null));
}

/** One block with its sizes and every review, or null when the brand has no such block. */
export async function getBlock(client: SupabaseClient, brandId: string, blockId: string): Promise<BlockDetail | null> {
  const block = await client.from("pattern_blocks").select(BLOCK_COLUMNS).eq("brand_id", brandId).eq("id", blockId).maybeSingle();
  failIf(block.error, "The pattern could not be read.");
  if (!block.data) return null;
  const sizes = await client.from("pattern_block_sizes").select(SIZE_COLUMNS).eq("brand_id", brandId).eq("block_id", blockId).order("position", { ascending: true });
  failIf(sizes.error, "The sizes of the pattern could not be read.");
  const reviews = await client.from("pattern_reviews").select(REVIEW_COLUMNS).eq("brand_id", brandId).eq("block_id", blockId).order("created_at", { ascending: false });
  failIf(reviews.error, "The pattern reviews could not be read.");
  const all = z.array(reviewRowSchema).parse(reviews.data ?? []).map(reviewOf);
  const sizeViews: SizeView[] = z.array(sizeRowSchema).parse(sizes.data ?? []).map((row) => ({
    size: row.size_label, position: row.position, pieces: row.pieces, measurements: row.measurements, skipped: row.skipped, checks: row.checks,
  }));
  return { block: viewOf(blockRowSchema.parse(block.data), all[0] ?? null), sizes: sizeViews, reviews: all };
}

export type NewBlock = Readonly<{
  brandId: string;
  userId: string;
  productKey: string;
  wearer: "men" | "women" | "youth";
  cut: "mens" | "womens" | "junior" | "unisex";
  name: string;
  source: BlockSource;
  set: PatternSet;
  overrides: Readonly<Record<string, Landmarks>>;
}>;

const rpcRow = z.array(z.object({ block_id: z.uuid(), block_version: z.number().int() })).length(1);

/** Stores a set as the next version of its block: the DXF of every size, one DXF of all, and the record. */
export async function createBlock(admin: SupabaseClient, input: NewBlock): Promise<{ id: string; version: number; setFileId: string }> {
  const { set } = input;
  const style = { styleName: input.name, status: DRAFT_NOTICE };
  const store = async (text: string): Promise<string> =>
    (await storeProductionFile("pattern-source", { admin, brandId: input.brandId, userId: input.userId, bytes: new TextEncoder().encode(text), contentType: "application/dxf" })).id;
  const everySize = set.sizes.flatMap((size) => set.piecesBySize[size]);
  const setFile = await store(writeDxf(everySize, style));
  const rows = [];
  for (const [position, size] of set.sizes.entries()) {
    rows.push({
      size, position, pieces: set.piecesBySize[size], measurements: set.measurementsBySize[size], skipped: set.skippedBySize[size],
      checks: set.checks.filter((c) => c.size === size), dxfFileId: await store(writeDxf(set.piecesBySize[size], style)),
    });
  }
  const { data, error } = await admin.rpc("create_pattern_block", {
    p_brand_id: input.brandId, p_user_id: input.userId, p_product_key: input.productKey, p_wearer: input.wearer, p_cut: input.cut,
    p_name: input.name, p_kind: "pieces", p_source: input.source, p_sizes: [...set.sizes], p_overrides: input.overrides,
    p_derived: [...set.derived], p_warnings: [...set.warnings], p_questions: [...set.questions], p_size_map: null, p_programme_note: null,
    p_set_file: setFile, p_size_rows: rows,
  });
  failIf(error, "The pattern could not be stored.");
  const [row] = rpcRow.parse(data);
  return { id: row.block_id, version: row.block_version, setFileId: setFile };
}

export type NewProgramme = Readonly<{
  brandId: string;
  userId: string;
  productKey: string;
  wearer: "men" | "women" | "youth";
  cut: "mens" | "womens" | "junior" | "unisex";
  name: string;
  source: BlockSource;
  sizeMap: Readonly<Record<string, string>>;
  note: string;
}>;

/** Stores a knit programme: the sock factory's size map and a note on its file. Never pieces. */
export async function createProgramme(admin: SupabaseClient, input: NewProgramme): Promise<{ id: string; version: number }> {
  const { data, error } = await admin.rpc("create_pattern_block", {
    p_brand_id: input.brandId, p_user_id: input.userId, p_product_key: input.productKey, p_wearer: input.wearer, p_cut: input.cut,
    p_name: input.name, p_kind: "knit-programme", p_source: input.source, p_sizes: [], p_overrides: {}, p_derived: [], p_warnings: [],
    p_questions: [], p_size_map: input.sizeMap, p_programme_note: input.note, p_set_file: null, p_size_rows: [],
  });
  failIf(error, "The knit programme could not be stored.");
  const [row] = rpcRow.parse(data);
  return { id: row.block_id, version: row.block_version };
}

/** Records a named person's review. Returns the new review's id. */
export async function recordReview(admin: SupabaseClient, ids: Readonly<{ brandId: string; userId: string; blockId: string }>, review: ReviewInput): Promise<string> {
  const { data, error } = await admin.rpc("review_pattern_block", {
    p_brand_id: ids.brandId, p_user_id: ids.userId, p_block_id: ids.blockId, p_name: review.reviewerName, p_role: review.reviewerRole,
    p_note: review.note, p_on: review.reviewedOn,
  });
  failIf(error, "The review could not be recorded.");
  return z.uuid().parse(data);
}

/** A block's DXF, built now so that it carries the block's present review line. */
export async function blockDxf(client: SupabaseClient, brandId: string, blockId: string, size: string | "all"): Promise<{ name: string; text: string } | null> {
  const detail = await getBlock(client, brandId, blockId);
  if (!detail || detail.block.kind !== "pieces") return null;
  const chosen = size === "all" ? detail.sizes : detail.sizes.filter((s) => s.size === size);
  if (chosen.length === 0) return null;
  const text = writeDxf(chosen.flatMap((s) => s.pieces), { styleName: detail.block.name, status: reviewLine(detail.block.review) });
  const slug = detail.block.productKey;
  return { name: `${slug}-v${detail.block.version}-${size === "all" ? "all-sizes" : size}.dxf`.replace(/[^a-zA-Z0-9._-]/g, "-"), text };
}
