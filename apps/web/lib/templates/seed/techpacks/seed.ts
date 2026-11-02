import type { SupabaseClient } from "@supabase/supabase-js";
import { getBaseArticle, listBaseArticles, type BaseArticle } from "@/lib/catalogue";
import { buildTechpackTemplates, techpackRowOf } from "./build";

/**
 * Puts the tech pack templates in the library with the service client (plan v5 L8, decision 0098).
 * One row per base article, found by its slug, so running this again changes the rows it made and
 * adds nothing.
 *
 * The articles are read from the catalogue rather than from a list in code: a template's page set and
 * its gaps are decided by what the article's own row holds, so the day a factory sends a point of
 * measure the template gains the page without a change here.
 */

/** Every base article in the catalogue, whole, in the order the catalogue lists them. */
export async function readBaseArticles(client: SupabaseClient): Promise<readonly BaseArticle[]> {
  const summaries = await listBaseArticles(client);
  const articles = await Promise.all(summaries.map((summary) => getBaseArticle(client, summary.code)));
  return articles.flatMap((article) => (article === null ? [] : [article]));
}

export async function seedTechpackTemplates(admin: SupabaseClient): Promise<number> {
  const articles = await readBaseArticles(admin);
  if (articles.length === 0) return 0;
  const rows = buildTechpackTemplates(articles).map(techpackRowOf);
  const { error } = await admin.from("template_techpacks").upsert(rows, { onConflict: "slug" });
  if (error) throw new Error(error.message);
  return rows.length;
}
