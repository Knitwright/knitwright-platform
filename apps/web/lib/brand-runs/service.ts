import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AppError } from "@/lib/server/core/errors";
import { throwIfFailed } from "./errors";
import { isStage, type Stage } from "./stage";
import type { ProductBody } from "./schemas";

/**
 * The product list in the database. Reads go through the member's own client, so row level security decides what they see.
 * Writes go through the server's client and the brand run functions, which check the person's role themselves; the brand and
 * the person always come from the session.
 */

export const PRODUCT_NOT_FOUND = "That product does not exist.";
export type Who = Readonly<{ brandId: string; userId: string }>;

const runRow = z.object({
  id: z.uuid(),
  kind: z.enum(["sample", "run"]),
  release_id: z.uuid(),
  pieces: z.number().int(),
  sizes: z.record(z.string(), z.number()),
  flags: z.array(z.object({ code: z.string(), text: z.string() })),
  order_id: z.uuid(),
  created_at: z.string(),
});

const productRow = z.object({
  id: z.uuid(),
  project_id: z.uuid(),
  name: z.string(),
  stage: z.string().refine(isStage),
  design_version: z.number().int(),
  created_at: z.string(),
  brand_runs: z.array(runRow),
});

const orderRow = z.object({ id: z.uuid(), status: z.string(), promised_on: z.string().nullable(), cutoff_at: z.string() });

export interface RunView {
  readonly id: string;
  readonly kind: "sample" | "run";
  readonly releaseId: string;
  readonly pieces: number;
  readonly sizes: Readonly<Record<string, number>>;
  readonly flags: readonly Readonly<{ code: string; text: string }>[];
  readonly createdAt: string;
  /** Where the order is in ops, read-only. Null when it cannot be read. */
  readonly order: Readonly<{ status: string; promisedOn: string | null; cutoffAt: string }> | null;
}

export interface ProductView {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly stage: Stage;
  readonly designVersion: number;
  readonly createdAt: string;
  readonly runs: readonly RunView[];
}

export async function listProducts(client: SupabaseClient, brandId: string): Promise<readonly ProductView[]> {
  const { data, error } = await client
    .from("brand_products")
    .select("id, project_id, name, stage, design_version, created_at, brand_runs(id, kind, release_id, pieces, sizes, flags, order_id, created_at)")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(200);
  throwIfFailed(error, PRODUCT_NOT_FOUND);
  const products = z.array(productRow).parse(data ?? []);
  const orderIds = products.flatMap((p) => p.brand_runs.map((r) => r.order_id));
  const orders = await readOrders(client, orderIds);
  return products.map((p) => ({
    id: p.id,
    projectId: p.project_id,
    name: p.name,
    stage: p.stage as Stage,
    designVersion: p.design_version,
    createdAt: p.created_at,
    runs: [...p.brand_runs]
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
      .map((r) => ({ id: r.id, kind: r.kind, releaseId: r.release_id, pieces: r.pieces, sizes: r.sizes, flags: r.flags, createdAt: r.created_at, order: orders.get(r.order_id) ?? null })),
  }));
}

async function readOrders(client: SupabaseClient, ids: readonly string[]): Promise<Map<string, NonNullable<RunView["order"]>>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await client.from("ops_orders").select("id, status, promised_on, cutoff_at").in("id", [...ids]);
  if (error) return new Map();
  return new Map(z.array(orderRow).parse(data ?? []).map((o) => [o.id, { status: o.status, promisedOn: o.promised_on, cutoffAt: o.cutoff_at }]));
}

export type ProductRef = Readonly<{ id: string; projectId: string; stage: Stage }>;

/** One product of the brand: enough to decide whether an order may be placed for it. */
export async function getProduct(client: SupabaseClient, brandId: string, productId: string): Promise<ProductRef> {
  const { data, error } = await client.from("brand_products").select("id, project_id, stage").eq("brand_id", brandId).eq("id", productId).maybeSingle();
  throwIfFailed(error, PRODUCT_NOT_FOUND);
  const row = z.object({ id: z.uuid(), project_id: z.uuid(), stage: z.string().refine(isStage) }).nullable().parse(data);
  if (!row) throw new AppError("not_found", PRODUCT_NOT_FOUND);
  return { id: row.id, projectId: row.project_id, stage: row.stage as Stage };
}

export async function createProduct(admin: SupabaseClient, who: Who, body: ProductBody): Promise<string> {
  const { data, error } = await admin.rpc("create_brand_product", { p_brand_id: who.brandId, p_user_id: who.userId, p_project_id: body.projectId, p_name: body.name });
  throwIfFailed(error, "That design does not exist.");
  return z.uuid().parse(data);
}

export async function confirmStage(admin: SupabaseClient, who: Who, productId: string, to: Stage): Promise<Stage> {
  const { data, error } = await admin.rpc("confirm_brand_product_stage", { p_brand_id: who.brandId, p_user_id: who.userId, p_product_id: productId, p_to: to });
  throwIfFailed(error, PRODUCT_NOT_FOUND);
  return z.string().refine(isStage).parse(data) as Stage;
}

export type RunToSubmit = Readonly<{
  productId: string;
  kind: "sample" | "run";
  releaseId: string;
  factoryProfileId: string;
  fabricKey: string;
  sizes: Readonly<Record<string, number>>;
  flags: readonly Readonly<{ code: string; text: string }>[];
  requestKey: string;
}>;

const submitted = z.tuple([
  z.object({ run_id: z.uuid(), order_id: z.uuid(), status: z.string(), cutoff_at: z.string(), promised_on: z.string().nullable(), created: z.boolean() }),
]);

export interface SubmittedRun {
  readonly runId: string;
  readonly orderId: string;
  readonly status: string;
  readonly cutoffAt: string;
  readonly promisedOn: string | null;
  /** False when the same request key had already been sent. */
  readonly created: boolean;
}

/** Sends a sample or run to ops through submit_order_for_production, inside the brand run function. */
export async function submitRun(admin: SupabaseClient, who: Who, run: RunToSubmit): Promise<SubmittedRun> {
  const { data, error } = await admin.rpc("submit_brand_run", {
    p_brand_id: who.brandId,
    p_user_id: who.userId,
    p_product_id: run.productId,
    p_kind: run.kind,
    p_release_id: run.releaseId,
    p_factory_profile_id: run.factoryProfileId,
    p_fabric_key: run.fabricKey,
    p_sizes: run.sizes,
    p_flags: run.flags,
    p_request_key: run.requestKey,
  });
  throwIfFailed(error, PRODUCT_NOT_FOUND);
  const [row] = submitted.parse(data);
  return { runId: row.run_id, orderId: row.order_id, status: row.status, cutoffAt: row.cutoff_at, promisedOn: row.promised_on, created: row.created };
}
