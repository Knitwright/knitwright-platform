import type { SupabaseClient } from "@supabase/supabase-js";
import { allSeedTemplates } from "./all";
import { australiaSeedTemplates } from "./australia/build";
import type { SeedTemplate } from "./build";
import { tagsOf } from "./tagging";

/** The row the table stores for a starter template, with the launch tags of `07` (decision 0098). */
export const rowOf = (seed: SeedTemplate) => {
  const tags = tagsOf(seed);
  return {
    slug: seed.slug,
    title: seed.title,
    kind: "design",
    sport: seed.sport,
    article_id: seed.articleId,
    wearer: seed.wearer,
    style_tags: [...seed.styleTags],
    colour_family: seed.colourFamily,
    sport_tags: [...tags.sport],
    era_tags: [...tags.era],
    mood_tags: [...tags.mood],
    snapshot: seed.snapshot,
    source: "knitwright",
    review_state: seed.reviewState,
  };
};

/**
 * Puts the starter templates in the library with the service client. A row is found by its slug, so running
 * this again changes the rows it made and adds nothing. A row a platform admin reviewed is left as it is.
 */
/**
 * Every starter the library holds: the 60 of `07` (L8, decision 0098) and the Australian starters beside
 * them (O3, decision 0104). `allSeedTemplates()` stays the 60 exactly, because that is what `07`'s launch
 * count counts, and the Australian rows have their own count in `australia/build.ts`.
 */
export const everySeedTemplate = (): readonly SeedTemplate[] => [...allSeedTemplates(), ...australiaSeedTemplates()];

export async function seedTemplates(admin: SupabaseClient): Promise<number> {
  const rows = everySeedTemplate().map(rowOf);
  const { data: reviewed, error: readError } = await admin.from("templates").select("slug").eq("review_state", "reviewed");
  if (readError) throw new Error(readError.message);
  const keep = new Set((reviewed ?? []).map((entry: { slug: string }) => entry.slug));
  const fresh = rows.filter((entry) => !keep.has(entry.slug));
  if (fresh.length === 0) return 0;
  const { error } = await admin.from("templates").upsert(fresh, { onConflict: "slug" });
  if (error) throw new Error(error.message);
  return fresh.length;
}
