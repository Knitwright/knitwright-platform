import type { SupabaseClient } from "@supabase/supabase-js";
import { buildMarketingTemplates, marketingRowOf } from "./build";

/**
 * Puts the 50 marketing templates in the library with the service client (plan v5 L4, decision
 * 0094). A row is found by its slug, so running this again changes the rows it made and adds
 * nothing. A row a platform admin has reviewed is left exactly as it is: the seed never writes over
 * somebody's review.
 *
 * It is the same idiom as L8's design seed (`lib/templates/seed/seed.ts`), on purpose. The rows it
 * writes are of kind `marketing`, which is why `loadLibrary` asks for `kind = 'design'` in the same
 * change (decision 0091's note to L2 to L6).
 */
export async function seedMarketingTemplates(admin: SupabaseClient): Promise<number> {
  const rows = buildMarketingTemplates().map(marketingRowOf);
  const { data: reviewed, error: readError } = await admin.from("templates").select("slug").eq("kind", "marketing").eq("review_state", "reviewed");
  if (readError) throw new Error(readError.message);
  const keep = new Set((reviewed ?? []).map((entry: { slug: string }) => entry.slug));
  const fresh = rows.filter((entry) => !keep.has(entry.slug));
  if (fresh.length === 0) return 0;
  const { error } = await admin.from("templates").upsert(fresh, { onConflict: "slug" });
  if (error) throw new Error(error.message);
  return fresh.length;
}
