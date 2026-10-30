import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import { MAPPING_SELECT, mappingRow, toMapping } from "./rows";
import type { OptionCodeMapping } from "./types";

/**
 * The read side of the option code map. Reads go through the client the caller passes, as the catalogue's own reads
 * do (`lib/catalogue/read.ts`), so the database's rules decide what is seen. Nothing here writes: the map is
 * platform data, seeded by its migration.
 */

/** One article's options are a handful of rows. Beyond this the read would be paged by the database instead. */
const READ_LIMIT = 200;

const unreadable = (cause: unknown): AppError => new AppError("internal", MESSAGES.internal, undefined, { cause });

const articleIdOf = async (client: SupabaseClient, code: string): Promise<string | null> => {
  const { data, error } = await client.from("base_articles").select("id").eq("code", code).maybeSingle();
  if (error) throw unreadable(error);
  const parsed = z.object({ id: z.uuid() }).nullable().safeParse(data);
  if (!parsed.success) throw unreadable(parsed.error);
  return parsed.data?.id ?? null;
};

/** The map's rows for one base article, in seed order. Empty for an article the map does not cover. */
export async function optionCodeMap(client: SupabaseClient, articleCode: string): Promise<readonly OptionCodeMapping[]> {
  const id = await articleIdOf(client, articleCode);
  if (id === null) return [];
  const { data, error } = await client
    .from("option_code_map")
    .select(MAPPING_SELECT)
    .eq("article_id", id)
    .order("position")
    .limit(READ_LIMIT);
  if (error) throw unreadable(error);
  const parsed = z.array(mappingRow).safeParse(data);
  if (!parsed.success) throw unreadable(parsed.error);
  return parsed.data.map((row) => toMapping(articleCode, row));
}
