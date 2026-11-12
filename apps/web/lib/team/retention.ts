import type { SupabaseClient } from "@supabase/supabase-js";
import type { Who } from "@/lib/clubs/service";
import { AppError } from "@/lib/server/core/errors";

/**
 * The club's opt-in to keep rosters older than two seasons (spec 05 security; D5's
 * `set_roster_retention`, decision 0136), given its screen on Team › Seasons by decision 0144.
 * No row means the club has not opted in, so old rosters are purged.
 */

export const RETENTION_NOT_SAVED = "The roster setting could not be saved. Only an owner or an admin can change it.";

/** Whether the club keeps old rosters, read as the member. A failed read is "no", the default the purge uses. */
export async function readRetention(client: SupabaseClient, brandId: string): Promise<boolean> {
  const { data, error } = await client.from("club_roster_retention").select("keep_old_rosters").eq("brand_id", brandId).maybeSingle();
  if (error || !data) return false;
  return (data as { keep_old_rosters: unknown }).keep_old_rosters === true;
}

/** Opts the club in or out, through the server's function, which checks the person may manage members. */
export async function saveRetention(admin: Pick<SupabaseClient, "rpc">, who: Who, keep: boolean): Promise<void> {
  const { error } = await admin.rpc("set_roster_retention", { p_brand_id: who.brandId, p_user_id: who.userId, p_keep: keep });
  if (!error) return;
  throw new AppError(error.code === "42501" ? "forbidden" : "internal", RETENTION_NOT_SAVED, undefined, { cause: error });
}

