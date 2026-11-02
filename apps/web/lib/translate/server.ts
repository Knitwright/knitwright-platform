import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { log } from "@/lib/server/log";
import { SOURCE_LANGUAGE, type Language } from "./languages";
import { TRANSLATION_COLUMNS, toTranslationRows, type TranslationRow } from "./rows";

/**
 * The words one language holds in the library (decision 0103). Joins `translation_strings` to the
 * caller's own client and holds no rules of its own: `rows.ts` reads a row and `dictionary.ts` decides
 * what a document says.
 *
 * A read that fails comes back empty rather than throwing. The document then falls back to the labelled
 * draft in `strings.ts`, which says on every page that nobody has read it, so a library that cannot be
 * read loses a translation and never a download.
 */
export async function loadTranslations(client: SupabaseClient, language: Language): Promise<readonly TranslationRow[]> {
  if (language === SOURCE_LANGUAGE) return [];
  const { data, error } = await client.from("translation_strings").select(TRANSLATION_COLUMNS).eq("language", language);
  if (error) {
    log({ level: "warn", message: "The translation library could not be read", where: "translations", error });
    return [];
  }
  return toTranslationRows((data ?? []) as Record<string, unknown>[]);
}
