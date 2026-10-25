import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import type { StoredSetting, StoredSettings } from "./types";

/**
 * Reads of the stored settings. The tables have no browser access, so these take the server's own client
 * (adminClient). A page or route calls them only after the person is known to be a platform admin, or, for the
 * read-through of an existing module, to learn a value the whole app is allowed to know.
 */

const row = z.object({ key: z.string(), value: z.unknown(), set_by: z.string().nullable(), set_at: z.string() });

const fromRow = (r: { value: unknown; set_by: string | null; set_at: string }): StoredSetting => ({ value: r.value, setBy: r.set_by, setAt: r.set_at });

export async function loadStored(client: SupabaseClient): Promise<StoredSettings> {
  const { data, error } = await client.from("platform_settings").select("key, value, set_by, set_at");
  if (error) throw new AppError("internal", MESSAGES.internal, undefined, { cause: error });
  return Object.fromEntries(z.array(row).parse(data ?? []).map((r) => [r.key, fromRow(r)]));
}

export type HistoryLine = StoredSetting & Readonly<{ id: string }>;

const historyRow = z.object({ id: z.string(), value: z.unknown(), set_by: z.string().nullable(), set_at: z.string() });

/** The changes to one setting, newest first. A null value is a reset to the default. */
export async function loadHistory(client: SupabaseClient, key: string, limit = 10): Promise<readonly HistoryLine[]> {
  const { data, error } = await client
    .from("platform_settings_history")
    .select("id, value, set_by, set_at")
    .eq("key", key)
    .order("seq", { ascending: false })
    .limit(limit);
  if (error) throw new AppError("internal", MESSAGES.internal, undefined, { cause: error });
  return z.array(historyRow).parse(data ?? []).map((r) => ({ id: r.id, ...fromRow(r) }));
}

/** Names for the people who made changes: their sign-in address, since an admin has no other name here. */
export async function loadNames(client: SupabaseClient, ids: readonly string[]): Promise<Readonly<Record<string, string>>> {
  const unique = [...new Set(ids)];
  const found = await Promise.all(
    unique.map(async (id) => {
      const { data } = await client.auth.admin.getUserById(id);
      return [id, data.user?.email ?? ""] as const;
    }),
  );
  return Object.fromEntries(found.filter(([, name]) => name !== ""));
}
