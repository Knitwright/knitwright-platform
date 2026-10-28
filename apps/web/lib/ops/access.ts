import type { SupabaseClient } from "@supabase/supabase-js";
import { amPlatformAdmin } from "@/lib/leads/service";
import { AppError } from "@/lib/server/core/errors";

/** The answer for anyone who is not a platform admin: the same as a route that does not exist. */
const OPS_NOT_FOUND = "Not found.";

/**
 * Throws "not found" unless the signed-in person (the client's own session) is a platform admin. Every ops
 * route and action calls this first. The database answers "admin" only for a valid token, and the ops
 * functions check the actor again themselves.
 */
export async function assertPlatformAdmin(client: SupabaseClient): Promise<void> {
  if (!(await amPlatformAdmin(client))) throw new AppError("not_found", OPS_NOT_FOUND);
}
