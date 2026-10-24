import type { SupabaseClient } from "@supabase/supabase-js";
import type { RosterRow } from "@/lib/production/contract";
import { getRelease } from "@/lib/releases/service";
import { getTeamOrder } from "@/lib/orders/service";
import { AppError } from "@/lib/server/core/errors";
import { throwIfQcFailed } from "../qc/errors";
import type { OpsOrder } from "../rows";
import { loadOrder } from "../service";
import type { PlannedBag } from "./bags";
import { BAG_COLUMNS, CARTON_COLUMNS, toBag, toCarton, type Carton, type PackBag } from "./rows";

type Admin = Pick<SupabaseClient, "rpc">;

export async function listBags(client: SupabaseClient, orderId: string): Promise<readonly PackBag[]> {
  const { data, error } = await client.from("ops_pack_bags").select(BAG_COLUMNS).eq("order_id", orderId).order("bag_no").limit(1000);
  throwIfQcFailed(error);
  return (data ?? []).map(toBag);
}

export async function listCartons(client: SupabaseClient, orderId: string): Promise<readonly Carton[]> {
  const { data, error } = await client.from("ops_cartons").select(CARTON_COLUMNS).eq("order_id", orderId).order("carton_no").limit(999);
  throwIfQcFailed(error);
  return (data ?? []).map(toCarton);
}

export interface TeamList {
  readonly teamOrderId: string | null;
  /** Null when the order has no team list, or it was erased. */
  readonly roster: readonly RosterRow[] | null;
}

/**
 * The team list of an order's release, read with the server's own client because ops reads across brands. A list
 * that was erased is a missing list, not a failure. Names are read here and never stored by ops.
 */
export async function loadTeamList(admin: SupabaseClient, order: OpsOrder): Promise<TeamList> {
  const release = await getRelease(admin, order.brandId, order.projectId, order.releaseId);
  if (release.orderId === null) return { teamOrderId: null, roster: null };
  try {
    return { teamOrderId: release.orderId, roster: (await getTeamOrder(admin, order.brandId, order.projectId, release.orderId)).rows };
  } catch (error) {
    if (error instanceof AppError && error.code === "not_found") return { teamOrderId: release.orderId, roster: null };
    throw error;
  }
}

/** The brand's name, for the heading of a document. */
export async function brandNameOf(admin: SupabaseClient, brandId: string): Promise<string> {
  const { data } = await admin.from("brands").select("name").eq("id", brandId).maybeSingle();
  return typeof data?.name === "string" ? data.name : "Unknown brand";
}

export async function loadPackingSource(client: SupabaseClient, admin: SupabaseClient, orderId: string) {
  const { order } = await loadOrder(client, orderId);
  const [bags, cartons, team, brandName] = await Promise.all([listBags(client, orderId), listCartons(client, orderId), loadTeamList(admin, order), brandNameOf(admin, order.brandId)]);
  return { order, bags, cartons, team, brandName };
}

/** Replaces the order's bags with the planned ones, while none is packed. */
export async function setBags(admin: Admin, actor: string, orderId: string, teamOrderId: string | null, bags: readonly PlannedBag[]): Promise<number> {
  const { data, error } = await admin.rpc("ops_set_bags", { p_actor: actor, p_order_id: orderId, p_team_order_id: teamOrderId, p_bags: bags });
  throwIfQcFailed(error);
  return typeof data === "number" ? data : bags.length;
}

export interface CartonToSet {
  readonly cartonNo: number;
  readonly weightG: number | null;
  readonly lengthMm: number | null;
  readonly widthMm: number | null;
  readonly heightMm: number | null;
}

export async function setCarton(admin: Admin, actor: string, orderId: string, c: CartonToSet): Promise<void> {
  throwIfQcFailed(
    (await admin.rpc("ops_set_carton", { p_actor: actor, p_order_id: orderId, p_carton_no: c.cartonNo, p_weight_g: c.weightG, p_length_mm: c.lengthMm, p_width_mm: c.widthMm, p_height_mm: c.heightMm })).error,
  );
}

export async function markBagPacked(admin: Admin, actor: string, bagId: string, cartonNo: number): Promise<void> {
  throwIfQcFailed((await admin.rpc("ops_mark_bag_packed", { p_actor: actor, p_bag_id: bagId, p_carton_no: cartonNo })).error);
}
