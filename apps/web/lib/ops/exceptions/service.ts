import type { SupabaseClient } from "@supabase/supabase-js";
import { throwIfQcFailed } from "../qc/errors";
import { EXCEPTION_COLUMNS, toException, type OpsException } from "./rows";
import type { ExceptionKind } from "./rules";

type Admin = Pick<SupabaseClient, "rpc">;

const LIMIT = 500;

/** Open exceptions first, for the exceptions page. Read with the person's own client: only platform admins can. */
export async function listExceptions(client: SupabaseClient, filter: Readonly<{ orderId?: string }> = {}): Promise<readonly OpsException[]> {
  const query = client.from("ops_exceptions").select(EXCEPTION_COLUMNS);
  const { data, error } = await (filter.orderId ? query.eq("order_id", filter.orderId) : query).order("status", { ascending: false }).order("due_on").order("id").limit(LIMIT);
  throwIfQcFailed(error);
  return (data ?? []).map(toException);
}

export interface ExceptionToRaise {
  readonly orderId: string;
  readonly kind: ExceptionKind;
  readonly owner: string;
  readonly dueOn: string;
  readonly note: string;
  readonly detail: Readonly<Record<string, unknown>>;
}

export async function raiseException(admin: Admin, actor: string, e: ExceptionToRaise): Promise<string> {
  const { data, error } = await admin.rpc("ops_raise_exception", {
    p_actor: actor, p_order_id: e.orderId, p_kind: e.kind, p_owner: e.owner, p_due_on: e.dueOn, p_note: e.note, p_detail: e.detail,
  });
  throwIfQcFailed(error);
  return String(data);
}

export async function updateException(admin: Admin, actor: string, id: string, owner: string, dueOn: string, note: string): Promise<void> {
  throwIfQcFailed((await admin.rpc("ops_update_exception", { p_actor: actor, p_id: id, p_owner: owner, p_due_on: dueOn, p_note: note })).error);
}

export async function resolveException(admin: Admin, actor: string, id: string, resolution: string): Promise<void> {
  throwIfQcFailed((await admin.rpc("ops_resolve_exception", { p_actor: actor, p_id: id, p_resolution: resolution })).error);
}
