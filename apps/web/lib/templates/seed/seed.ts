import type { SupabaseClient } from "@supabase/supabase-js";
import { allSeedTemplates } from "./all";
import type { SeedTemplate } from "./build";

/** The row the table stores for a starter template. */
export const rowOf = (seed: SeedTemplate) => ({
  slug: seed.slug,
  title: seed.title,
  sport: seed.sport,
  article_id: seed.articleId,
  wearer: seed.wearer,
  style_tags: [...seed.styleTags],
  colour_family: seed.colourFamily,
  snapshot: seed.snapshot,
  source: "knitwright",
  review_state: seed.reviewState,
});

/**
 * Puts the starter templates in the library with the service client. A row is found by its slug, so running
 * this again changes the rows it made and adds nothing. A row a platform admin reviewed is left as it is.
 */
export async function seedTemplates(admin: SupabaseClient): Promise<number> {
  const rows = allSeedTemplates().map(rowOf);
  const { data: reviewed, error: readError } = await admin.from("templates").select("slug").eq("review_state", "reviewed");
  if (readError) throw new Error(readError.message);
  const keep = new Set((reviewed ?? []).map((entry: { slug: string }) => entry.slug));
  const fresh = rows.filter((entry) => !keep.has(entry.slug));
  if (fresh.length === 0) return 0;
  const { error } = await admin.from("templates").upsert(fresh, { onConflict: "slug" });
  if (error) throw new Error(error.message);
  return fresh.length;
}
