/**
 * The template library of the launch rail, read and filtered on the server (plan v5, decision
 * 0106).
 *
 * **It uses L8's own functions and writes no second filter.** `matchesTags`, `matchesSearch`,
 * `TAG_CHOICES` and `gapForType` were left ready for exactly this panel (decision 0098, "No filter
 * panel for the new tags"), and they reach zod through `lib/garment` and `lib/catalogue`, which
 * `tests/architecture/client-weight.test.ts` refuses to let a client component pull into the
 * browser. So the search and the five filters run here, where zod already lives, and the panel is
 * handed rows that have already been narrowed.
 *
 * **The read asks for the kinds the panel can render, and no others.** `lib/templates/service.ts`
 * parses every row against the design shape; this file parses every row against the shape of a
 * card, and a card is drawn from a design template -- it names the garment the design is drawn on
 * and what that garment has no data for. The other six kinds of `07` have no `article_id` to read
 * a gap from and reach the canvas through their own boards, so the read names `design` and the
 * view says so.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getType } from "@/lib/garment";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import { REVIEW_LABELS, REVIEW_STATES, SPORTS, SPORT_LABELS, STYLE_IDS } from "@/lib/templates/catalogue";
import { COLOUR_FAMILIES } from "@/lib/templates/colour-family";
import type { TemplateKind } from "@/lib/templates/kinds";
import {
  ERA_TAGS,
  MOOD_TAGS,
  SPORT_TAGS,
  SPORT_TAG_LABELS,
  TAG_CHOICES,
  TAG_GROUPS,
  TAG_GROUP_LABELS,
  matchesSearch,
  matchesTags,
  type TagFilter,
  type TagGroup,
  type TemplateTags,
} from "@/lib/templates/kinds/tags";
import { gapForType } from "@/lib/templates/kinds/gaps";
import type { TagFilterGroup, TemplateCard, TemplatesView } from "./view";

/** The kinds of template this panel can draw a card for. A card names a garment, so: designs. */
export const PANEL_KINDS = ["design"] as const satisfies readonly TemplateKind[];

/** The library is small and platform-owned; beyond this it would be paged by the database. */
const READ_LIMIT = 500;

const COLUMNS = "id, slug, title, sport, article_id, style_tags, colour_family, review_state, attribution, sport_tags, era_tags, mood_tags";

const row = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  sport: z.enum(SPORTS),
  article_id: z.string(),
  style_tags: z.array(z.enum(STYLE_IDS)).min(1),
  colour_family: z.enum(COLOUR_FAMILIES),
  review_state: z.enum(REVIEW_STATES),
  attribution: z.string().nullable().optional(),
  // A value the closed vocabulary does not hold is dropped rather than failing the whole read: the
  // database's own check keeps the column clean, and a panel must not go blank over one tag.
  sport_tags: z.array(z.string()).catch([]),
  era_tags: z.array(z.string()).catch([]),
  mood_tags: z.array(z.string()).catch([]),
});

type Row = z.infer<typeof row>;

const unreadable = (cause: unknown): AppError => new AppError("internal", MESSAGES.internal, undefined, { cause });

const only = <T extends string>(known: readonly T[], given: readonly string[]): readonly T[] => known.filter((value) => given.includes(value));

/** The five tags one row carries, in the shape L8's own filter takes. */
export const tagsOf = (entry: Row): TemplateTags => ({
  sport: only(SPORT_TAGS, entry.sport_tags),
  style: entry.style_tags,
  era: only(ERA_TAGS, entry.era_tags),
  mood: only(MOOD_TAGS, entry.mood_tags),
  colour: entry.colour_family,
});

/** The collection a row is filed under: its sport group of `07`, or the column's own sport. */
const collectionOf = (tags: TemplateTags, entry: Row): string =>
  tags.sport.length === 0 ? SPORT_LABELS[entry.sport] : SPORT_TAG_LABELS[tags.sport[0]!];

const cardOf = (entry: Row, tags: TemplateTags): TemplateCard => {
  const gap = gapForType(entry.article_id);
  return {
    id: entry.id,
    slug: entry.slug,
    title: entry.title,
    collection: collectionOf(tags, entry),
    articleLabel: getType(entry.article_id)?.label ?? entry.article_id,
    reviewLabel: REVIEW_LABELS[entry.review_state],
    attribution: entry.attribution ?? null,
    gap: gap === null ? null : { ruleId: gap.ruleId, line: gap.line },
  };
};

/** One row of the library, kept beside its tags so the filters and the search read the same facts. */
interface Tagged {
  readonly card: TemplateCard;
  readonly tags: TemplateTags;
}

/**
 * Every template of the kinds this panel renders, as cards with their tags. The read names the
 * kinds it can draw, so a row of another kind can never reach a card that would misread it.
 */
export async function loadPanelTemplates(client: SupabaseClient): Promise<readonly Tagged[]> {
  const { data, error } = await client.from("templates").select(COLUMNS).in("kind", [...PANEL_KINDS]).order("slug").limit(READ_LIMIT);
  if (error) throw unreadable(error);
  const parsed = z.array(row).safeParse(data);
  if (!parsed.success) throw unreadable(parsed.error);
  return parsed.data.map((entry) => {
    const tags = tagsOf(entry);
    return { card: cardOf(entry, tags), tags };
  });
}

/** What the panel asked for: the words typed, and one choice per tag group at most. */
export interface PanelQuery {
  readonly text: string;
  readonly tags: TagFilter;
}

/** How many of the rows carry each choice of each group, against the filters other groups set. */
const countsFor = (rows: readonly Tagged[], query: PanelQuery, group: TagGroup): TagFilterGroup => {
  const others: TagFilter = Object.fromEntries(Object.entries(query.tags).filter(([name]) => name !== group));
  const narrowed = rows.filter((entry) => matchesTags(entry.tags, others) && matchesSearch(entry.card.title, entry.tags, query.text));
  return {
    group,
    label: TAG_GROUP_LABELS[group],
    choices: TAG_CHOICES[group]
      .map((choice) => ({ id: choice.id, label: choice.label, count: narrowed.filter((entry) => matchesTags(entry.tags, { [group]: choice.id })).length }))
      // A choice nothing carries is left out: a chip that can only ever show nothing is noise.
      .filter((choice) => choice.count > 0),
  };
};

const matches = (entry: Tagged, query: PanelQuery): boolean =>
  matchesTags(entry.tags, query.tags) && matchesSearch(entry.card.title, entry.tags, query.text);

/** Everything the templates panel shows for one search and one set of filters. */
export function templatesView(rows: readonly Tagged[], query: PanelQuery): TemplatesView {
  return {
    cards: rows.filter((entry) => matches(entry, query)).map((entry) => entry.card),
    total: rows.length,
    filters: TAG_GROUPS.map((group) => countsFor(rows, query, group)).filter((entry) => entry.choices.length > 0),
    kinds: [...PANEL_KINDS],
  };
}

export type { Tagged };
