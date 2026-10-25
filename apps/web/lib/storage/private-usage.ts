import type { SupabaseClient } from "@supabase/supabase-js";
import { CLEAN_FOLDER } from "@/lib/media/paths";

/**
 * Clean pictures, turntable videos and clips live under `_private/<brand>/` with no `files` row, so
 * `brand_storage_used` cannot see them. This adds them up from the storage listing, so they count toward the quota.
 */

const PAGE = 1000;
/** `_private/<brand>/<set>/<file>`: a folder holds sets, a set holds files. */
const MAX_FOLDER_LEVELS = 3;

type Listed = Readonly<{ name: string; id: string | null; metadata?: { size?: number } | null }>;

const walk = async (admin: SupabaseClient, prefix: string, level: number): Promise<number> => {
  let total = 0;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await admin.storage.from("images").list(prefix, { limit: PAGE, offset });
    if (error) throw new Error("The brand's private media could not be measured.", { cause: error });
    const entries = (data ?? []) as readonly Listed[];
    for (const entry of entries) {
      if (entry.id !== null) total += Number(entry.metadata?.size ?? 0);
      else if (level < MAX_FOLDER_LEVELS) total += await walk(admin, `${prefix}/${entry.name}`, level + 1);
    }
    if (entries.length < PAGE) return total;
  }
};

export const privateMediaBytes = (admin: SupabaseClient, brandId: string): Promise<number> =>
  walk(admin, `${CLEAN_FOLDER}/${brandId}`, 1);
