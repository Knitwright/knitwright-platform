import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { FLOW_TEMPLATES } from "@/lib/flows/templates";
import { listMarketingTemplates } from "@/lib/marketing/service";
import { VIDEO_TEMPLATES, buildableNow, waitingLine } from "@/lib/media/video/social-frames";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import { REVIEW_STATES, SPORTS, STYLE_IDS } from "../catalogue";
import { COLOUR_FAMILIES } from "../colour-family";
import { previewOf } from "../preview";
import { loadSnapshots } from "../service";
import { designItem, packItem, socialItems, techpackItem, videoItem, withPicture, type DesignRow, type FeedItem } from "./items";

/**
 * The Templates page's reads (decision 0140). Every read goes through the member's own client, so
 * the database's rules decide what they see, as the library always has (`../service.ts`).
 *
 * Each read names the one kind it parses (L8's warning in `../service.ts`). Flow packs and video
 * templates are the platform's own lists in code, exactly as the launch rail reads them.
 */

const unreadable = (cause: unknown): AppError => new AppError("internal", MESSAGES.internal, undefined, { cause });
const READ_LIMIT = 500;
const NOT_YET = "This template cannot be made here yet.";

const DESIGN_COLUMNS = "id, slug, title, sport, article_id, style_tags, colour_family, review_state, attribution, sport_tags";

const designRow = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  sport: z.enum(SPORTS),
  article_id: z.string(),
  style_tags: z.array(z.enum(STYLE_IDS)).min(1),
  colour_family: z.enum(COLOUR_FAMILIES),
  review_state: z.enum(REVIEW_STATES),
  attribution: z.string().nullable().optional(),
  sport_tags: z.array(z.string()).catch([]),
});

/** Every design template with its sport tags, in slug order. */
export async function loadDesignRows(client: SupabaseClient): Promise<readonly DesignRow[]> {
  const { data, error } = await client.from("templates").select(DESIGN_COLUMNS).eq("kind", "design").order("slug").limit(READ_LIMIT);
  if (error) throw unreadable(error);
  const parsed = z.array(designRow).safeParse(data);
  if (!parsed.success) throw unreadable(parsed.error);
  return parsed.data.map((row) => ({
    sportTags: row.sport_tags,
    summary: {
      id: row.id,
      slug: row.slug,
      title: row.title,
      sport: row.sport,
      articleId: row.article_id,
      style: row.style_tags[0]!,
      styleTags: row.style_tags,
      colourFamily: row.colour_family,
      reviewState: row.review_state,
      ...(row.attribution ? { attribution: row.attribution } : {}),
    },
  }));
}

async function loadTechpacks(client: SupabaseClient): Promise<readonly FeedItem[]> {
  const { data, error } = await client.from("templates").select("id, title").eq("kind", "techpack").order("slug").limit(READ_LIMIT);
  if (error) throw unreadable(error);
  const parsed = z.array(z.object({ id: z.uuid(), title: z.string() })).safeParse(data);
  if (!parsed.success) throw unreadable(parsed.error);
  return parsed.data.map(techpackItem);
}

/** Where a video template is made: the 3D view of the brand's newest design, or a new design. */
export const studioHrefFor = (latestDesignId: string | null): string =>
  latestDesignId === null ? "/studio/start" : `/project/${encodeURIComponent(latestDesignId)}?focus=garment&view=3d`;

/** Every card the page can show, without pictures. */
export async function loadFeed(client: SupabaseClient, designs: readonly DesignRow[], latestDesignId: string | null): Promise<readonly FeedItem[]> {
  const [marketing, techpacks] = await Promise.all([listMarketingTemplates(client), loadTechpacks(client)]);
  const studio = studioHrefFor(latestDesignId);
  return [
    ...designs.map(designItem),
    ...FLOW_TEMPLATES.map(packItem),
    ...socialItems(marketing),
    ...VIDEO_TEMPLATES.map((template) => videoItem(template, studio, buildableNow(template) ? null : (waitingLine(template) ?? NOT_YET))),
    ...techpacks,
  ];
}

/** The same items, with the designs named here drawn. Nothing else is drawn, so a page draws only what it shows. */
export async function withPictures(client: SupabaseClient, items: readonly FeedItem[], ids: readonly string[]): Promise<readonly FeedItem[]> {
  const snapshots = await loadSnapshots(client, ids);
  return items.map((item) => (snapshots.has(item.id) ? withPicture(item, previewOf(snapshots.get(item.id))) : item));
}
