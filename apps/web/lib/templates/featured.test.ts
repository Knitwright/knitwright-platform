import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { FEATURED_COUNT, featuredTemplates, pickFeatured } from "./featured";
import { rowOf } from "./seed/seed";
import { buildSeedTemplates } from "./seed/build";
import type { TemplateSummary } from "./filters";

const summaries: TemplateSummary[] = buildSeedTemplates().map((seed, n) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  slug: seed.slug,
  title: seed.title,
  sport: seed.sport,
  articleId: seed.articleId,
  style: seed.style,
  styleTags: [...seed.styleTags],
  colourFamily: seed.colourFamily,
  reviewState: seed.reviewState,
}));

describe("the templates the start offers first", () => {
  it("picks a few, one per sport first so the choice is wide, in a fixed order", () => {
    const picked = pickFeatured(summaries);
    expect(picked).toHaveLength(FEATURED_COUNT);
    expect(new Set(picked.map((entry) => entry.sport)).size).toBe(FEATURED_COUNT);
    expect(pickFeatured(summaries)).toEqual(picked);
  });

  it("fills up from the rest when there are fewer sports than places, and copes with a small library", () => {
    const oneSport = summaries.map((entry) => ({ ...entry, sport: "football" as const }));
    expect(pickFeatured(oneSport)).toHaveLength(FEATURED_COUNT);
    expect(pickFeatured(summaries.slice(0, 2))).toHaveLength(2);
    expect(pickFeatured([])).toEqual([]);
  });

  it("reads them, with a drawing for each", async () => {
    const rows = buildSeedTemplates().map((seed, n) => ({ id: summaries[n]!.id, ...rowOf(seed) }));
    const query = { select: () => query, order: () => query, limit: async () => ({ data: rows, error: null }), in: async () => ({ data: rows, error: null }) };
    const shown = await featuredTemplates({ from: () => query } as unknown as SupabaseClient);
    expect(shown).toHaveLength(FEATURED_COUNT);
    expect(shown.every((entry) => entry.preview !== null)).toBe(true);
  });
});
