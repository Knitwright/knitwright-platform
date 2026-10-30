import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { mappingRows } from "./fixtures/source";
import { optionCodeMap } from "./read";
import { OPTION_CODE_MAP_SEED } from "./seed/rows";

const ARTICLE_ID = "11111111-1111-4111-8111-111111111111";
type Answer = { data: unknown; error: { message: string } | null };

/** A client that answers each table with a fixed result and records the filters asked for. */
function fakeClient(tables: Record<string, Answer>) {
  const asked: { table: string; filters: [string, unknown][] }[] = [];
  const client = {
    from: (table: string) => {
      const filters: [string, unknown][] = [];
      asked.push({ table, filters });
      const answer = tables[table] ?? { data: null, error: null };
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => (filters.push([column, value]), query),
        order: () => query,
        limit: async () => answer,
        maybeSingle: async () => answer,
      };
      return query;
    },
  } as unknown as SupabaseClient;
  return { client, asked };
}

const withArticle = (rows: unknown, error: { message: string } | null = null) =>
  fakeClient({ base_articles: { data: { id: ARTICLE_ID }, error: null }, option_code_map: { data: rows, error } });

describe("reading the map", () => {
  it("reads every row of one article back as it was seeded", async () => {
    const { client, asked } = withArticle(mappingRows());
    expect(await optionCodeMap(client, "JSY-SS-01")).toEqual(OPTION_CODE_MAP_SEED);
    expect(asked[0]?.table).toBe("base_articles");
    expect(asked[1]).toEqual({ table: "option_code_map", filters: [["article_id", ARTICLE_ID]] });
  });

  it("is empty for an article the catalogue does not hold", async () => {
    expect(await optionCodeMap(fakeClient({}).client, "XXX-XX-00")).toEqual([]);
  });

  it("is empty for an article the map does not cover", async () => {
    const { client } = withArticle([]);
    expect(await optionCodeMap(client, "TEE-TR-01")).toEqual([]);
  });

  it("reports a failed read, a row it cannot read, and an article id it cannot read", async () => {
    await expect(optionCodeMap(withArticle(null, { message: "boom" }).client, "JSY-SS-01")).rejects.toBeInstanceOf(AppError);
    await expect(optionCodeMap(withArticle([{ position: 0 }]).client, "JSY-SS-01")).rejects.toBeInstanceOf(AppError);
    const broken = fakeClient({ base_articles: { data: { id: "not-a-uuid" }, error: null } });
    await expect(optionCodeMap(broken.client, "JSY-SS-01")).rejects.toBeInstanceOf(AppError);
    const failed = fakeClient({ base_articles: { data: null, error: { message: "boom" } } });
    await expect(optionCodeMap(failed.client, "JSY-SS-01")).rejects.toBeInstanceOf(AppError);
  });
});
