import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { failureFromDatabase } from "@/lib/projects/database-errors";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import { REVIEW_STATES, SPORTS, STYLE_IDS } from "./catalogue";
import { COLOUR_FAMILIES } from "./colour-family";
import { specFromSnapshot } from "./copy";
import type { TemplateSummary } from "./filters";

/**
 * Reads of the library go through the signed-in member's own client, so the database's rules decide what they
 * see. A new design is made through the same `create_project` function as the guided start, with the server's client.
 */

/** The library is small and platform-owned. Beyond this many rows it would be paged by the database instead. */
const LIBRARY_READ_LIMIT = 500;

const SUMMARY_COLUMNS = "id, slug, title, sport, article_id, style_tags, colour_family, review_state, attribution";

const summaryRow = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  sport: z.enum(SPORTS),
  article_id: z.string(),
  style_tags: z.array(z.enum(STYLE_IDS)).min(1),
  colour_family: z.enum(COLOUR_FAMILIES),
  review_state: z.enum(REVIEW_STATES),
  attribution: z.string().nullable().optional(),
});

const NOT_FOUND = "That template does not exist.";
const unreadable = (cause: unknown): AppError => new AppError("internal", MESSAGES.internal, undefined, { cause });

/** Every template, in a fixed order, without its design. */
export async function loadLibrary(client: SupabaseClient): Promise<readonly TemplateSummary[]> {
  const { data, error } = await client.from("templates").select(SUMMARY_COLUMNS).order("slug").limit(LIBRARY_READ_LIMIT);
  if (error) throw unreadable(error);
  const parsed = z.array(summaryRow).safeParse(data);
  if (!parsed.success) throw unreadable(parsed.error);
  return parsed.data.map((row) => ({
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
  }));
}

/** The designs of the templates on one page, by id. */
export async function loadSnapshots(client: SupabaseClient, ids: readonly string[]): Promise<ReadonlyMap<string, unknown>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await client.from("templates").select("id, snapshot").in("id", [...ids]);
  if (error) throw unreadable(error);
  const parsed = z.array(z.object({ id: z.uuid(), snapshot: z.unknown() })).safeParse(data);
  if (!parsed.success) throw unreadable(parsed.error);
  return new Map(parsed.data.map((row) => [row.id, row.snapshot]));
}

type NewFromTemplate = Readonly<{ brandId: string; userId: string; templateId: string }>;

/**
 * Makes a new design in the brand from a template, as version 1, and returns its id. The design is a deep copy of
 * the template's snapshot; nothing links the two afterwards. The brand and user come from the session.
 */
export async function createFromTemplate(admin: SupabaseClient, client: SupabaseClient, input: NewFromTemplate): Promise<string> {
  const { data, error } = await client.from("templates").select("title, snapshot, source").eq("id", input.templateId).maybeSingle();
  if (error) throw unreadable(error);
  const row = z.object({ title: z.string(), snapshot: z.unknown(), source: z.string().optional() }).nullish().parse(data);
  if (!row) throw new AppError("not_found", NOT_FOUND);
  const copy = specFromSnapshot(row.snapshot);
  if (!copy.ok) throw new AppError("unavailable", copy.reason);
  const created = await admin.rpc("create_project", {
    p_brand_id: input.brandId,
    p_user_id: input.userId,
    p_name: row.title,
    p_style_number: "",
    p_season: "",
    p_garment_type: copy.spec.typeId,
    p_spec: copy.spec,
    p_schema_version: copy.spec.schemaVersion,
  });
  if (created.error) throw failureFromDatabase(created.error);
  const projectId = z.uuid().parse(created.data);
  // A design made from a designer's template is noted, so its orders can earn the designer a royalty (decision 0061).
  if (row.source === "designer") {
    const noted = await admin.rpc("designer_record_use", { p_template_id: input.templateId, p_brand_id: input.brandId, p_project_id: projectId });
    if (noted.error) throw failureFromDatabase(noted.error);
  }
  return projectId;
}
