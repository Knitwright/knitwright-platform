import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { OrderStatus } from "@/lib/ops/status";
import { orderNumber } from "./format";
import { goldenRow, milestoneRow, nameRow, ORDER_COLUMNS, orderRow, runKindRow, trackingSchema, type OrderRow } from "./rows";
import type { GoldenSample } from "./views";
import { customerStatus, NO_MILESTONES, type CustomerStatus, type Milestones } from "./status";

/**
 * Reads a brand's orders for the Orders area (decision 0143), with the member's own client: row level
 * security keeps every read to the brand, and the two tracking functions answer only for a member.
 */

export const ORDERS_SHOWN = 200;

export interface CustomerOrder {
  readonly id: string;
  readonly number: string;
  readonly releaseId: string;
  readonly projectId: string;
  /** The design's name, or the release label when the design is gone. */
  readonly productName: string;
  /** A sample or a run placed from Product runs or the make flow; "order" for anything else. */
  readonly kind: "sample" | "run" | "order";
  readonly articleId: string;
  readonly fabricKey: string;
  readonly sizes: Readonly<Record<string, number>>;
  readonly pieces: number;
  readonly value: Readonly<{ minor: number; currency: string }> | null;
  readonly opsStatus: OrderStatus;
  readonly status: CustomerStatus;
  readonly milestones: Milestones;
  readonly release: Readonly<{ label: string; number: number }>;
  /** The factory's ready date ops promised, or null. */
  readonly readyOn: string | null;
  readonly createdAt: string;
}

export class OrdersUnreadable extends Error {
  override readonly name = "OrdersUnreadable";
}

const fail = (error: unknown): never => {
  throw new OrdersUnreadable("The orders could not be read.", { cause: error });
};

async function namesOf(client: SupabaseClient, brandId: string, projectIds: readonly string[]): Promise<Map<string, string>> {
  if (projectIds.length === 0) return new Map();
  const { data, error } = await client.from("projects").select("id, name").eq("brand_id", brandId).in("id", [...new Set(projectIds)]);
  if (error) return new Map();
  return new Map(z.array(nameRow).parse(data ?? []).map((row) => [row.id, row.name]));
}

async function kindsOf(client: SupabaseClient, brandId: string, orderIds: readonly string[]): Promise<Map<string, "sample" | "run">> {
  if (orderIds.length === 0) return new Map();
  const { data, error } = await client.from("brand_runs").select("order_id, kind").eq("brand_id", brandId).in("order_id", [...orderIds]);
  if (error) return new Map();
  return new Map(z.array(runKindRow).parse(data ?? []).map((row) => [row.order_id, row.kind]));
}

/** When each order passed QC and first shipped. A failed read leaves every order at its ops state. */
export async function milestonesOf(client: SupabaseClient, orderIds: readonly string[]): Promise<Map<string, Milestones>> {
  if (orderIds.length === 0) return new Map();
  const { data, error } = await client.rpc("customer_order_milestones", { p_order_ids: [...orderIds] });
  if (error) return new Map();
  return new Map(z.array(milestoneRow).parse(data ?? []).map((row) => [row.order_id, { qcPassedAt: row.qc_passed_at, shippedOn: row.shipped_on }]));
}

type Joins = Readonly<{ names: Map<string, string>; kinds: Map<string, "sample" | "run">; milestones: Map<string, Milestones> }>;

function toOrder(row: OrderRow, joins: Joins): CustomerOrder {
  const milestones = joins.milestones.get(row.id) ?? NO_MILESTONES;
  const release = { label: row.release_snapshot.label ?? "", number: row.release_snapshot.number ?? 0 };
  return {
    id: row.id,
    number: orderNumber(row.id),
    releaseId: row.release_id,
    projectId: row.project_id,
    productName: joins.names.get(row.project_id) ?? (release.label || "A design no longer on file"),
    kind: joins.kinds.get(row.id) ?? "order",
    articleId: row.article_id,
    fabricKey: row.fabric_key,
    sizes: row.sizes,
    pieces: row.pieces,
    value: row.value_minor === null || row.currency === null ? null : { minor: row.value_minor, currency: row.currency },
    opsStatus: row.status,
    status: customerStatus(row.status, milestones),
    milestones,
    release,
    readyOn: row.promised_on,
    createdAt: row.created_at,
  };
}

async function withJoins(client: SupabaseClient, brandId: string, rows: readonly OrderRow[]): Promise<readonly CustomerOrder[]> {
  const ids = rows.map((row) => row.id);
  const [names, kinds, milestones] = await Promise.all([
    namesOf(client, brandId, rows.map((row) => row.project_id)),
    kindsOf(client, brandId, ids),
    milestonesOf(client, ids),
  ]);
  return rows.map((row) => toOrder(row, { names, kinds, milestones }));
}

/** The brand's orders, newest first. */
export async function listOrders(client: SupabaseClient, brandId: string): Promise<readonly CustomerOrder[]> {
  const { data, error } = await client
    .from("ops_orders")
    .select(ORDER_COLUMNS)
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(ORDERS_SHOWN);
  if (error) fail(error);
  const rows = z.array(orderRow).safeParse(data ?? []);
  if (!rows.success) return fail(rows.error);
  return withJoins(client, brandId, rows.data);
}

/** One order of the brand, or null when there is none by that id. */
export async function getOrder(client: SupabaseClient, brandId: string, orderId: string): Promise<CustomerOrder | null> {
  if (!z.uuid().safeParse(orderId).success) return null;
  const { data, error } = await client.from("ops_orders").select(ORDER_COLUMNS).eq("brand_id", brandId).eq("id", orderId).maybeSingle();
  if (error) fail(error);
  if (data === null) return null;
  const row = orderRow.safeParse(data);
  if (!row.success) return fail(row.error);
  const [order] = await withJoins(client, brandId, [row.data]);
  return order ?? null;
}

/** The brand's golden samples, newest first. */
export async function listGolden(client: SupabaseClient, brandId: string): Promise<readonly GoldenSample[]> {
  const { data, error } = await client
    .from("golden_samples")
    .select("id, product_id, version, state, approved_at, created_at")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(ORDERS_SHOWN);
  if (error) fail(error);
  const rows = z.array(goldenRow).safeParse(data ?? []);
  if (!rows.success) return fail(rows.error);
  return rows.data.map((row) => ({ id: row.id, productId: row.product_id, version: row.version, state: row.state, createdAt: row.created_at }));
}

export interface Parcel {
  readonly courier: string;
  readonly trackingNumber: string;
  readonly trackingUrl: string | null;
  readonly shippedOn: string;
  readonly pieces: number;
}

export interface Tracking {
  readonly parcels: readonly Parcel[];
  /** The photos of passing inspections ops chose to share, oldest first. */
  readonly photoFileIds: readonly string[];
}

export const NO_TRACKING: Tracking = { parcels: [], photoFileIds: [] };

/** The parcels and the shared QC photos of one order. */
export async function trackingOf(client: SupabaseClient, orderId: string): Promise<Tracking> {
  const { data, error } = await client.rpc("customer_order_tracking", { p_order_id: orderId });
  if (error) fail(error);
  if (data === null) return NO_TRACKING;
  const parsed = trackingSchema.safeParse(data);
  if (!parsed.success) return fail(parsed.error);
  return {
    parcels: parsed.data.shipments.map((s) => ({ courier: s.courier, trackingNumber: s.tracking_number, trackingUrl: s.tracking_url, shippedOn: s.shipped_on, pieces: s.pieces })),
    photoFileIds: parsed.data.inspections.flatMap((i) => i.photo_file_ids),
  };
}
