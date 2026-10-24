import type { SupabaseClient } from "@supabase/supabase-js";
import type { TemplateSummary } from "./filters";
import { previewOf, type TemplatePreview } from "./preview";
import { loadLibrary, loadSnapshots } from "./service";

/** How many templates the start of a design offers before the blank canvas. */
export const FEATURED_COUNT = 4;

/** A few templates from different sports first, then the rest in order. The library's order is fixed, so this is too. */
export function pickFeatured(all: readonly TemplateSummary[]): readonly TemplateSummary[] {
  const firstOfEachSport = all.filter((entry, at) => all.findIndex((other) => other.sport === entry.sport) === at);
  const rest = all.filter((entry) => !firstOfEachSport.includes(entry));
  return [...firstOfEachSport, ...rest].slice(0, FEATURED_COUNT);
}

export type FeaturedTemplate = Readonly<{ template: TemplateSummary; preview: TemplatePreview | null }>;

export async function featuredTemplates(client: SupabaseClient): Promise<readonly FeaturedTemplate[]> {
  const picked = pickFeatured(await loadLibrary(client));
  const snapshots = await loadSnapshots(client, picked.map((entry) => entry.id));
  return picked.map((template) => ({ template, preview: previewOf(snapshots.get(template.id)) }));
}
