import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { catalogue, optionRowOf, parameterRowOf, rowOf } from "./fixtures/source";
import { getBaseArticle, listBaseArticles, optionsFor, parameterRange } from "./read";

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
        then: (resolve: (value: Answer) => unknown) => resolve(answer),
      };
      return query;
    },
  } as unknown as SupabaseClient;
  return { client, asked };
}

const [jersey, ...drafts] = catalogue();

describe("getBaseArticle", () => {
  it("reads an article back exactly as it was seeded, children in order", async () => {
    const { client, asked } = fakeClient({ base_articles: { data: rowOf(jersey!), error: null } });
    expect(await getBaseArticle(client, "JSY-SS-01")).toEqual(jersey);
    expect(asked[0]).toEqual({ table: "base_articles", filters: [["code", "JSY-SS-01"]] });
  });

  it("reads a draft with nothing but its fabric codes", async () => {
    const { client } = fakeClient({ base_articles: { data: rowOf(drafts[0]!), error: null } });
    expect(await getBaseArticle(client, drafts[0]!.code)).toEqual(drafts[0]);
  });

  it("answers null for an unknown code", async () => {
    expect(await getBaseArticle(fakeClient({}).client, "XXX-XX-00")).toBeNull();
  });

  it("reports a failed read and a row it cannot read", async () => {
    await expect(getBaseArticle(fakeClient({ base_articles: { data: null, error: { message: "boom" } } }).client, "JSY-SS-01")).rejects.toBeInstanceOf(AppError);
    const bad = { ...rowOf(jersey!), production_class: "C" };
    await expect(getBaseArticle(fakeClient({ base_articles: { data: bad, error: null } }).client, "JSY-SS-01")).rejects.toBeInstanceOf(AppError);
  });
});

describe("listBaseArticles", () => {
  const rows = catalogue().map(rowOf);

  it("lists every article with its fabric codes, and filters", async () => {
    const { client } = fakeClient({ base_articles: { data: rows, error: null } });
    const all = await listBaseArticles(client);
    expect(all.map((a) => a.code)).toEqual(catalogue().map((a) => a.code));
    expect(all[0]!.fabricCodes).toEqual(["F-POLY-INT", "F-POLY-RIB"]);
    expect((await listBaseArticles(client, { sport: "cricket" })).map((a) => a.code)).toEqual(["CRK-SS-01"]);
  });

  it("refuses an unknown filter, and reports a failed read", async () => {
    const { client } = fakeClient({ base_articles: { data: rows, error: null } });
    await expect(listBaseArticles(client, { colour: "red" } as never)).rejects.toMatchObject({ code: "invalid_input" });
    await expect(listBaseArticles(fakeClient({ base_articles: { data: null, error: { message: "boom" } } }).client)).rejects.toBeInstanceOf(AppError);
  });
});

describe("parameterRange", () => {
  const parameter = jersey!.parameters[0]!;

  it("reads one range of an article", async () => {
    const { client, asked } = fakeClient({
      base_articles: { data: { id: ARTICLE_ID }, error: null },
      parameter_defs: { data: parameterRowOf(parameter, 0), error: null },
    });
    expect(await parameterRange(client, "JSY-SS-01", parameter.key)).toEqual(parameter);
    expect(asked[1]).toEqual({ table: "parameter_defs", filters: [["article_id", ARTICLE_ID], ["key", parameter.key]] });
  });

  it("answers null for an unknown article or key, and reports a failed read", async () => {
    expect(await parameterRange(fakeClient({}).client, "XXX-XX-00", "x")).toBeNull();
    expect(await parameterRange(fakeClient({ base_articles: { data: { id: ARTICLE_ID }, error: null } }).client, "JSY-SS-01", "x")).toBeNull();
    const failing = fakeClient({ base_articles: { data: { id: ARTICLE_ID }, error: null }, parameter_defs: { data: null, error: { message: "boom" } } });
    await expect(parameterRange(failing.client, "JSY-SS-01", "x")).rejects.toBeInstanceOf(AppError);
    await expect(parameterRange(fakeClient({ base_articles: { data: null, error: { message: "boom" } } }).client, "JSY-SS-01", "x")).rejects.toBeInstanceOf(AppError);
  });
});

describe("optionsFor", () => {
  const collars = jersey!.options.filter((option) => option.group === "collar");

  it("reads the options of one group", async () => {
    const { client, asked } = fakeClient({
      base_articles: { data: { id: ARTICLE_ID }, error: null },
      option_defs: { data: collars.map(optionRowOf), error: null },
    });
    expect(await optionsFor(client, "JSY-SS-01", "collar")).toEqual(collars);
    expect(asked[1]).toEqual({ table: "option_defs", filters: [["article_id", ARTICLE_ID], ["option_group", "collar"]] });
  });

  it("answers nothing for an unknown article, and reports a failed read", async () => {
    expect(await optionsFor(fakeClient({}).client, "XXX-XX-00", "collar")).toEqual([]);
    const failing = fakeClient({ base_articles: { data: { id: ARTICLE_ID }, error: null }, option_defs: { data: null, error: { message: "boom" } } });
    await expect(optionsFor(failing.client, "JSY-SS-01", "collar")).rejects.toBeInstanceOf(AppError);
  });
});
