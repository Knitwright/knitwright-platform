import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { VOICE_TAGS } from "@/lib/brand-studio/words";
import { baseArticleForType } from "@/lib/catalogue";
import { getType } from "@/lib/garment";
import { screenTextContent } from "@/lib/moderation/text";
import { STYLE_LABELS, type StyleId } from "@/lib/templates/catalogue";
import { filterHref, filtersFromQuery } from "@/lib/templates/filters";
import { previewOf } from "@/lib/templates/preview";
import { loadSnapshots } from "@/lib/templates/service";
import { tagText } from "./context-query";
import type { ArticleContext, BrandMoodReader, CardScreen, InspirationPorts, LibraryItem, LibraryReader } from "./ports";
import { scoreItem } from "./sources/library";
import type { InspirationCard } from "./types";
import { CARDS_PER_SOURCE } from "./vocabulary";

/**
 * The real ports of `ports.ts` (plan v6 D4, decision 0135). Until this file, every server action built the board on
 * `UNWIRED_INSPIRATION_PORTS`, so in production the library row was always empty, the query had no sport and no mood
 * words, and no card was screened. The unwired set stays exactly as it was: it is what the unit tests use.
 *
 * Every read here goes through the signed-in member's own client, so the database's rules decide what is seen. A port
 * that only adds words to the query (the article, the mood) says "nothing known" when its read fails, so a missing
 * profile never takes the board down; the library faults instead, and the board says so in that row.
 */

/** The base article's name and sport tags, read straight from the catalogue row. */
export function articleContextFrom(client: SupabaseClient): ArticleContext {
  const row = z.object({ name: z.string().min(1), sport_tags: z.array(z.string()) });
  return {
    articleFor: async (typeId) => {
      const code = baseArticleForType(typeId);
      if (code === undefined) return null;
      const { data, error } = await client.from("base_articles").select("name, sport_tags").eq("code", code).maybeSingle();
      const parsed = row.safeParse(data);
      return error || !parsed.success ? null : { name: parsed.data.name, sportTags: parsed.data.sport_tags };
    },
  };
}

/** The brand's mood words: the voice words it chose in Brand Studio (F-S9), in Brand Studio's own order. */
export function brandMoodFrom(client: SupabaseClient): BrandMoodReader {
  const row = z.object({ voice_tags: z.array(z.string()) });
  return {
    moodWordsFor: async (brandId) => {
      const { data, error } = await client.from("brand_profiles").select("voice_tags").eq("brand_id", brandId).maybeSingle();
      const parsed = row.safeParse(data);
      return error || !parsed.success ? [] : VOICE_TAGS.filter((tag) => parsed.data.voice_tags.includes(tag));
    },
  };
}

/** One design template as the library row reads it. */
const templateRow = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string().min(1),
  sport: z.string(),
  article_id: z.string(),
  style_tags: z.array(z.string()),
  colour_family: z.string(),
  sport_tags: z.array(z.string()),
  era_tags: z.array(z.string()),
  mood_tags: z.array(z.string()),
});
export type TemplateRow = z.output<typeof templateRow>;

const TEMPLATE_COLUMNS = "id, slug, title, sport, article_id, style_tags, colour_family, sport_tags, era_tags, mood_tags";
/** The library is small and platform-owned, as `lib/templates/service.ts` reads it. */
const LIBRARY_READ_LIMIT = 500;

/** Said when a template card is saved: its picture is drawn on request, so there is no served address to keep. */
export const LIBRARY_UNSAVEABLE = "A Knitwright template is drawn when it is shown and is not stored as a picture, so it cannot be saved to a moodboard. Open it from the template library.";

/** The words a template is matched on: its sport, garment, styles, colour family and look-and-feel tags. */
export function libraryTagsOf(row: TemplateRow): readonly string[] {
  const styles = row.style_tags.flatMap((id) => [id, STYLE_LABELS[id as StyleId] ?? id]);
  const sports = row.sport_tags.flatMap((tag) => [tag, ...tag.split("-")]);
  const words = [row.sport, row.article_id, getType(row.article_id)?.label ?? "", ...styles, row.colour_family, ...sports, ...row.era_tags, ...row.mood_tags];
  return [...new Set(words.map(tagText).filter((word) => word !== ""))];
}

/** Knitwright's design templates, matched on their tags and drawn by Knitwright's own renderer. */
export function templateLibraryFrom(client: SupabaseClient, siteUrl: string): LibraryReader {
  return {
    search: async (_brandId, query) => {
      const { data, error } = await client.from("templates").select(TEMPLATE_COLUMNS).eq("kind", "design").order("slug").limit(LIBRARY_READ_LIMIT);
      if (error) throw new Error("The template library could not be read.", { cause: error });
      const rows = (Array.isArray(data) ? data : []).flatMap((entry) => {
        const parsed = templateRow.safeParse(entry);
        return parsed.success ? [{ row: parsed.data, tags: libraryTagsOf(parsed.data) }] : [];
      });
      // Only the best matches are drawn: drawing is the costly part, and the source shows no more than this many.
      const best = rows
        .map((entry) => ({ ...entry, score: scoreItem(entry.tags, query) }))
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score || left.row.id.localeCompare(right.row.id))
        .slice(0, CARDS_PER_SOURCE);
      if (best.length === 0) return [];
      const snapshots = await loadSnapshots(client, best.map((entry) => entry.row.id));
      return best.flatMap(({ row, tags }): LibraryItem[] => {
        const preview = previewOf(snapshots.get(row.id));
        if (preview === null) return [];
        // Read back through the library's own filter parser, so a value the library does not list is left out.
        const filters = filtersFromQuery({ sport: row.sport, article: row.article_id, style: row.style_tags[0] });
        return [{ id: row.id, title: row.title, openUrl: `${siteUrl}${filterHref("/templates", filters, 1)}`, previewUrl: preview.src, tags, kindLabel: "Template", unsaveable: LIBRARY_UNSAVEABLE }];
      });
    },
  };
}

/**
 * Moderation's text screen (X8, decision 0073) over the words a card shows: its title and its creator's name. A card
 * moderation would block is not shown. The screen runs in the "label" context, where a brand name only flags: the
 * link-preview row exists to show brand and competitor products (F-S1), so a brand name alone must not empty it, and a
 * flagged card is still shown. For the same reason the registry of marks is not read: in this context a mark can only
 * flag, so it could not change which cards are shown.
 */
export const cardScreen: CardScreen = {
  screen: async (cards) => cards.filter((entry) => !blocked(entry)),
};

const blocked = (entry: InspirationCard): boolean =>
  [entry.title, entry.attribution.creator ?? ""].some((text) => text !== "" && screenTextContent(text, "label", []).result === "blocked");

/** All four ports over the member's own client. What every server action of the board passes. */
export const inspirationPorts = (client: SupabaseClient, siteUrl: string): InspirationPorts => ({
  articles: articleContextFrom(client),
  mood: brandMoodFrom(client),
  library: templateLibraryFrom(client, siteUrl),
  screen: cardScreen,
});
