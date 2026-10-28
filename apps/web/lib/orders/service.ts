import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { rosterRowSchema, type RosterRow } from "@/lib/production/contract";
import { AppError } from "@/lib/server/core/errors";
import { throwIfFailed } from "./errors";

/**
 * Team orders in the database. Reads go through the member's own client, so the database's rules
 * decide what they see. Writes go through the server's client and the save function, which checks
 * the user belongs to the brand. The brand always comes from the session.
 */

const ORDER_NOT_FOUND = "That team order does not exist.";
const DESIGN_NOT_FOUND = "That design does not exist.";

export interface OrderSummary {
  readonly id: string;
  readonly name: string;
  readonly players: number;
  readonly updatedAt: string;
}

export interface StoredOrder {
  readonly id: string;
  readonly name: string;
  readonly updatedAt: string;
  readonly rows: readonly RosterRow[];
}

const summaryRow = z.object({
  id: z.uuid(),
  name: z.string(),
  updated_at: z.string(),
  team_order_rows: z.array(z.object({ count: z.number().int() })),
});

export async function listTeamOrders(client: SupabaseClient, brandId: string, projectId: string): Promise<readonly OrderSummary[]> {
  const { data, error } = await client
    .from("team_orders")
    .select("id, name, updated_at, team_order_rows(count)")
    .eq("brand_id", brandId)
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false })
    .limit(50);
  throwIfFailed(error, DESIGN_NOT_FOUND);
  return z.array(summaryRow).parse(data ?? []).map((r) => ({ id: r.id, name: r.name, players: r.team_order_rows[0]?.count ?? 0, updatedAt: r.updated_at }));
}

const orderRow = z.object({ id: z.uuid(), name: z.string(), updated_at: z.string() });
const lineRow = z.object({ name: z.string(), number: z.string(), size_label: z.string(), cut: z.string(), quantity: z.number().int() });

export async function getTeamOrder(client: SupabaseClient, brandId: string, projectId: string, orderId: string): Promise<StoredOrder> {
  const head = await client.from("team_orders").select("id, name, updated_at").eq("id", orderId).eq("brand_id", brandId).eq("project_id", projectId).maybeSingle();
  throwIfFailed(head.error, ORDER_NOT_FOUND);
  if (!head.data) throw new AppError("not_found", ORDER_NOT_FOUND);
  const order = orderRow.parse(head.data);
  const lines = await client.from("team_order_rows").select("name, number, size_label, cut, quantity").eq("order_id", orderId).eq("brand_id", brandId).order("position", { ascending: true }).limit(1000);
  throwIfFailed(lines.error, ORDER_NOT_FOUND);
  const rows = z.array(lineRow).parse(lines.data ?? []).map((r) =>
    rosterRowSchema.parse({ name: r.name, number: r.number, sizeLabel: r.size_label, cut: r.cut, quantity: r.quantity }),
  );
  return { id: order.id, name: order.name, updatedAt: order.updated_at, rows };
}

type OrderToSave = Readonly<{
  orderId?: string;
  projectId: string;
  brandId: string;
  userId: string;
  name: string;
  rows: readonly RosterRow[];
}>;

/** Makes a team order, or replaces the name and every row of one. Returns its id. */
export async function saveTeamOrder(admin: SupabaseClient, order: OrderToSave): Promise<string> {
  const { data, error } = await admin.rpc("save_team_order", {
    p_order_id: order.orderId ?? null,
    p_project_id: order.projectId,
    p_brand_id: order.brandId,
    p_user_id: order.userId,
    p_name: order.name,
    p_rows: order.rows.map((r) => ({ name: r.name, number: r.number, size_label: r.sizeLabel, cut: r.cut, quantity: r.quantity })),
  });
  throwIfFailed(error, order.orderId ? ORDER_NOT_FOUND : DESIGN_NOT_FOUND);
  return z.uuid().parse(data);
}

/** Erases a team order and every name in it. Nothing else keeps a copy: a release holds a hash only. */
export async function deleteTeamOrder(admin: SupabaseClient, brandId: string, projectId: string, orderId: string): Promise<void> {
  const { data, error } = await admin.from("team_orders").delete().eq("id", orderId).eq("brand_id", brandId).eq("project_id", projectId).select("id");
  throwIfFailed(error, ORDER_NOT_FOUND);
  if (!data || data.length === 0) throw new AppError("not_found", ORDER_NOT_FOUND);
}
