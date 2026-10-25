import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import { findSetting } from "./registry";

/**
 * Sets one setting, or puts it back to the Knitwright default (value null). Refuses an unknown key and a value
 * its schema rejects, in words, before the database is called. The database function refuses anyone who is not
 * a platform admin and writes the history line in the same step.
 */
export async function writeSetting(admin: SupabaseClient, actor: string, key: string, value: unknown): Promise<void> {
  const def = findSetting(key);
  if (!def) throw new AppError("invalid_input", "That setting does not exist.");
  if (value !== null) {
    const checked = def.schema.safeParse(value);
    if (!checked.success) throw new AppError("invalid_input", checked.error.issues[0]?.message ?? MESSAGES.invalid_input);
  }
  const { error } = await admin.rpc("platform_setting_set", { p_actor: actor, p_key: key, p_value: value });
  if (error?.code === "P0002") throw new AppError("not_found", "Not found.");
  if (error) throw new AppError("internal", MESSAGES.internal, undefined, { cause: error });
}
