import type { SupabaseClient } from "@supabase/supabase-js";
import { throwIfOpsFailed } from "../errors";
import type { CutRun } from "./cut";

type Admin = Pick<SupabaseClient, "rpc">;
type Reader = Pick<SupabaseClient, "from">;

/** Runs the scheduled cut. The database is idempotent on the cut-off, so calling this twice cuts once. */
export async function runScheduledCut(admin: Admin, now?: Date): Promise<CutRun> {
  const { data, error } = await admin.rpc("ops_cut_scheduled", { ...(now ? { p_now: now.toISOString() } : {}) });
  throwIfOpsFailed(error);
  const row = (Array.isArray(data) ? data[0] : data) as { cut_for: string; orders_batched: number; ran: boolean } | undefined;
  if (!row) throw new Error("ops_cut_scheduled answered with nothing");
  return { cutFor: new Date(row.cut_for).toISOString(), ordersBatched: row.orders_batched, ran: row.ran };
}

/** The runs so far, newest first, for the screen that shows whether the schedule is working. */
export async function listCutRuns(client: Reader, limit = 10): Promise<readonly CutRun[]> {
  const { data, error } = await client.from("ops_cut_runs").select("cut_for, orders_batched").order("cut_for", { ascending: false }).limit(limit);
  throwIfOpsFailed(error);
  return (data ?? []).map((row) => {
    const r = row as { cut_for: string; orders_batched: number };
    return { cutFor: new Date(r.cut_for).toISOString(), ordersBatched: r.orders_batched, ran: true };
  });
}
