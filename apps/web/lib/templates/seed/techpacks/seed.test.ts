import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { catalogue, rowOf } from "@/lib/catalogue/fixtures/source";
import { buildTechpackTemplates } from "./build";
import { readBaseArticles, seedTechpackTemplates } from "./seed";

/** A client that answers the two reads of the catalogue from the committed articles, and keeps what is written. */
function fakeAdmin(options: { articles?: readonly string[]; fail?: boolean } = {}) {
  // `.order("code")` is what the real read does, so the fake answers in code order too.
  const rows = [...catalogue()].sort((a, b) => a.code.localeCompare(b.code)).map(rowOf);
  const kept = options.articles ?? rows.map((row) => row.code as string);
  const written: { arg?: unknown; options?: unknown }[] = [];
  const client = {
    from: (table: string) => {
      if (table === "template_techpacks") {
        return {
          upsert: async (arg: unknown, upsertOptions: unknown) => {
            written.push({ arg, options: upsertOptions });
            return { error: options.fail === true ? { message: "write failed" } : null };
          },
        };
      }
      return {
        select: () => ({
          order: () => ({ limit: async () => ({ data: rows.filter((row) => kept.includes(row.code as string)), error: null }) }),
          eq: (_column: string, code: string) => ({
            maybeSingle: async () => ({ data: rows.find((row) => row.code === code) ?? null, error: null }),
          }),
        }),
      };
    },
  };
  return { client: client as unknown as SupabaseClient, written };
}

describe("reading the articles the templates are made from", () => {
  it("reads every base article whole, in the catalogue's order", async () => {
    const articles = await readBaseArticles(fakeAdmin().client);

    expect(articles.map((article) => article.code)).toEqual([...catalogue()].map((article) => article.code).sort());
    expect(articles.find((article) => article.code === "JSY-SS-01")!.poms.length).toBeGreaterThan(0);
  });
});

describe("seeding the tech pack templates", () => {
  it("writes one row per base article, keyed by slug", async () => {
    const { client, written } = fakeAdmin();

    expect(await seedTechpackTemplates(client)).toBe(8);
    expect(written).toHaveLength(1);
    expect(written[0]!.options).toEqual({ onConflict: "slug" });
    const rows = written[0]!.arg as { slug: string; base_article_code: string }[];
    expect(new Set(rows.map((row) => row.base_article_code)).size).toBe(8);
    expect(rows.map((row) => row.slug)).toEqual(buildTechpackTemplates(await readBaseArticles(client)).map((template) => template.slug));
  });

  it("writes nothing when the catalogue is empty, rather than a row for an article it invented", async () => {
    const { client, written } = fakeAdmin({ articles: [] });

    expect(await seedTechpackTemplates(client)).toBe(0);
    expect(written).toEqual([]);
  });

  it("reports a failed write", async () => {
    await expect(seedTechpackTemplates(fakeAdmin({ fail: true }).client)).rejects.toThrow("write failed");
  });
});
