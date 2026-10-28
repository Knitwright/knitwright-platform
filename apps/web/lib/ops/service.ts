import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/server/core/errors";
import { summariseOrders, type OrderSummary } from "./grouping";
import { NOT_FOUND, throwIfOpsFailed } from "./errors";
import { toBatch, toEvent, toOrder, toSettings, type Batch, type OpsOrder, type OrderEvent } from "./rows";
import type { OpsSettings } from "./settings";
import type { OrderStatus } from "./status";

/**
 * Ops reads and writes. Reads use the person's own client: row level security lets a platform admin read
 * ops tables. Writes use the server's client with the actor's id, and every function refuses anyone who is
 * not a platform admin (migration 20261025050000).
 */

const LIMIT = 1000;

export async function loadSettings(client: SupabaseClient): Promise<OpsSettings> {
  const { data, error } = await client.from("ops_settings").select("cutoff_weekday, cutoff_time, lead_time_days, label").maybeSingle();
  throwIfOpsFailed(error);
  return toSettings(data);
}

interface BatchListItem extends Batch {
  readonly orders: number;
  readonly summary: OrderSummary;
  readonly byStatus: Readonly<Partial<Record<OrderStatus, number>>>;
}

const countBy = (orders: readonly OpsOrder[]): Partial<Record<OrderStatus, number>> =>
  orders.reduce<Partial<Record<OrderStatus, number>>>((n, o) => ({ ...n, [o.status]: (n[o.status] ?? 0) + 1 }), {});

/** Newest cut-off first. */
export async function listBatches(client: SupabaseClient): Promise<readonly BatchListItem[]> {
  const [batches, orders] = await Promise.all([
    client.from("batches").select("id, factory_profile_id, fabric_key, article_id, cutoff_at").order("cutoff_at", { ascending: false }).limit(LIMIT),
    client.from("ops_orders").select("*").not("batch_id", "is", null).limit(LIMIT * 10),
  ]);
  throwIfOpsFailed(batches.error);
  throwIfOpsFailed(orders.error);
  const all = (orders.data ?? []).map(toOrder);
  return (batches.data ?? []).map(toBatch).map((batch) => {
    const mine = all.filter((o) => o.batchId === batch.id);
    return { ...batch, orders: mine.length, summary: summariseOrders(mine), byStatus: countBy(mine) };
  });
}

/** Orders not in a batch: waiting for their cut-off, or held. */
export async function listWaitingOrders(client: SupabaseClient): Promise<readonly OpsOrder[]> {
  const { data, error } = await client.from("ops_orders").select("*").is("batch_id", null).order("cutoff_at").order("id").limit(LIMIT);
  throwIfOpsFailed(error);
  return (data ?? []).map(toOrder);
}

export async function loadBatch(client: SupabaseClient, batchId: string): Promise<{ batch: Batch; orders: readonly OpsOrder[] }> {
  const [batch, orders] = await Promise.all([
    client.from("batches").select("id, factory_profile_id, fabric_key, article_id, cutoff_at").eq("id", batchId).maybeSingle(),
    client.from("ops_orders").select("*").eq("batch_id", batchId).order("created_at").order("id").limit(LIMIT),
  ]);
  throwIfOpsFailed(batch.error);
  throwIfOpsFailed(orders.error);
  if (!batch.data) throw new AppError("not_found", NOT_FOUND);
  return { batch: toBatch(batch.data), orders: (orders.data ?? []).map(toOrder) };
}

/** Open batches an order could move to: same factory, fabric and article, other than the one it is in. */
export async function movableBatches(client: SupabaseClient, order: OpsOrder): Promise<readonly Batch[]> {
  const { data, error } = await client
    .from("batches")
    .select("id, factory_profile_id, fabric_key, article_id, cutoff_at")
    .eq("factory_profile_id", order.factoryProfileId)
    .eq("fabric_key", order.fabricKey)
    .eq("article_id", order.articleId)
    .order("cutoff_at", { ascending: false })
    .limit(20);
  throwIfOpsFailed(error);
  return (data ?? []).map(toBatch).filter((b) => b.id !== order.batchId);
}

export async function loadOrder(client: SupabaseClient, orderId: string): Promise<{ order: OpsOrder; events: readonly OrderEvent[] }> {
  const [order, events] = await Promise.all([
    client.from("ops_orders").select("*").eq("id", orderId).maybeSingle(),
    client.from("ops_order_events").select("id, kind, from_status, to_status, promised_on, note, at").eq("order_id", orderId).order("at").order("id").limit(500),
  ]);
  throwIfOpsFailed(order.error);
  throwIfOpsFailed(events.error);
  if (!order.data) throw new AppError("not_found", NOT_FOUND);
  return { order: toOrder(order.data), events: (events.data ?? []).map(toEvent) };
}

type Admin = Pick<SupabaseClient, "rpc">;

export async function cutBatches(admin: Admin, actor: string, now?: Date): Promise<number> {
  const { data, error } = await admin.rpc("ops_cut_batches", { p_actor: actor, ...(now ? { p_now: now.toISOString() } : {}) });
  throwIfOpsFailed(error);
  return typeof data === "number" ? data : 0;
}

export async function moveOrder(admin: Admin, actor: string, orderId: string, batchId: string, note = ""): Promise<void> {
  throwIfOpsFailed((await admin.rpc("ops_move_order", { p_actor: actor, p_order_id: orderId, p_batch_id: batchId, p_note: note })).error);
}

export async function setHold(admin: Admin, actor: string, orderId: string, hold: boolean, note = ""): Promise<void> {
  throwIfOpsFailed((await admin.rpc("ops_set_hold", { p_actor: actor, p_order_id: orderId, p_hold: hold, p_note: note })).error);
}

export async function setOrderStatus(admin: Admin, actor: string, orderId: string, to: OrderStatus, note = ""): Promise<void> {
  throwIfOpsFailed((await admin.rpc("ops_set_order_status", { p_actor: actor, p_order_id: orderId, p_to: to, p_note: note })).error);
}

export async function delayOrder(admin: Admin, actor: string, orderId: string, newDate: string, reason: string): Promise<void> {
  throwIfOpsFailed((await admin.rpc("ops_delay_order", { p_actor: actor, p_order_id: orderId, p_new_date: newDate, p_reason: reason })).error);
}

export async function saveSettings(admin: Admin, actor: string, s: OpsSettings): Promise<void> {
  throwIfOpsFailed(
    (await admin.rpc("ops_update_settings", { p_actor: actor, p_weekday: s.cutoffWeekday, p_minutes: s.cutoffMinutes, p_lead_time_days: s.leadTimeDays, p_label: s.label })).error,
  );
}
