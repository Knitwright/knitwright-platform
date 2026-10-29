import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import { catalogueFiltersSchema, filterArticles, type CatalogueFilters } from "./filters";
import { ARTICLE_SELECT, articleRow, optionRow, parameterRow, SUMMARY_SELECT, summaryRow, toArticle, toOption, toParameter, toSummary } from "./rows";
import type { BaseArticle, BaseArticleSummary, OptionDef, ParameterDef } from "./types";

/**
 * The read API of the base article catalogue. Reads go through the client the caller passes: the signed-in member's
 * own client in a page, so the database's rules decide what is seen. Nothing here writes.
 */

/** The catalogue is small and platform-owned. Beyond this many articles it would be paged by the database instead. */
const CATALOGUE_READ_LIMIT = 200;

const unreadable = (cause: unknown): AppError => new AppError("internal", MESSAGES.internal, undefined, { cause });

const parsed = <T>(schema: z.ZodType<T>, data: unknown): T => {
  const result = schema.safeParse(data);
  if (!result.success) throw unreadable(result.error);
  return result.data;
};

/** One base article with its points of measure, ranges, options, construction and fabrics, or null when unknown. */
export async function getBaseArticle(client: SupabaseClient, code: string): Promise<BaseArticle | null> {
  const { data, error } = await client.from("base_articles").select(ARTICLE_SELECT).eq("code", code).maybeSingle();
  if (error) throw unreadable(error);
  const row = parsed(articleRow.nullable(), data);
  return row ? toArticle(row) : null;
}

/** The catalogue, filtered, in code order. The filters are checked first; an unknown filter is refused. */
export async function listBaseArticles(client: SupabaseClient, filters: CatalogueFilters = {}): Promise<readonly BaseArticleSummary[]> {
  const wanted = catalogueFiltersSchema.safeParse(filters);
  if (!wanted.success) throw new AppError("invalid_input", "Those catalogue filters are not ones the catalogue knows.");
  const { data, error } = await client.from("base_articles").select(SUMMARY_SELECT).order("code").limit(CATALOGUE_READ_LIMIT);
  if (error) throw unreadable(error);
  return filterArticles(parsed(z.array(summaryRow), data).map(toSummary), wanted.data);
}

const articleIdOf = async (client: SupabaseClient, code: string): Promise<string | null> => {
  const { data, error } = await client.from("base_articles").select("id").eq("code", code).maybeSingle();
  if (error) throw unreadable(error);
  return parsed(z.object({ id: z.uuid() }).nullable(), data)?.id ?? null;
};

/** The range a factory makes for one parameter of an article, or null when the article or the parameter is unknown. */
export async function parameterRange(client: SupabaseClient, code: string, key: string): Promise<ParameterDef | null> {
  const id = await articleIdOf(client, code);
  if (!id) return null;
  const { data, error } = await client
    .from("parameter_defs")
    .select("position, key, type, min, max, step, default_value, enum_values, unit, affects_panels, pom_letters, rule_id, approved_by_sample_id")
    .eq("article_id", id)
    .eq("key", key)
    .maybeSingle();
  if (error) throw unreadable(error);
  const row = parsed(parameterRow.nullable(), data);
  return row ? toParameter(row) : null;
}

/** The options of one group of an article (collar, sleeve_finish), in catalogue order. Empty for an unknown article or group. */
export async function optionsFor(client: SupabaseClient, code: string, group: string): Promise<readonly OptionDef[]> {
  const id = await articleIdOf(client, code);
  if (!id) return [];
  const { data, error } = await client
    .from("option_defs")
    .select("position, option_group, code, label, is_default, thumbnail_key, extra_cost_minor, currency, rule_id, approved_by_sample_id")
    .eq("article_id", id)
    .eq("option_group", group)
    .order("position");
  if (error) throw unreadable(error);
  return parsed(z.array(optionRow), data).map(toOption);
}
