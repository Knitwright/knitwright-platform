import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { SUBLIMATION } from "../scope";
import { databaseRetrieval, searchRulebook, versionsOfRules } from "./retrieve";

/**
 * The two reads retrieval makes of the database, against a stand-in client (the idiom of
 * `lib/rulebook/store.test.ts`): what is asked of `rulebook_search`, which columns are read back, and that a
 * failed read is a plain internal failure rather than something half-read. The real SQL is exercised against a
 * real database in `tests/integration/rulebook-search.test.ts`.
 */

type Answer = { data?: unknown; error?: { message: string } | null };
type Call = { table?: string; fn?: string; args?: unknown; select?: string; filters: unknown[] };

const fake = (answer: Answer) => {
  const calls: Call[] = [];
  const reply = { data: answer.data ?? null, error: answer.error ?? null };
  const chain = (call: Call) => {
    const q: Record<string, unknown> = {};
    q.select = (cols: string) => ((call.select = cols), q);
    for (const m of ["in", "order"]) q[m] = (...a: unknown[]) => (call.filters.push([m, ...a]), q);
    q.then = (resolve: (v: unknown) => unknown) => resolve(reply);
    return q;
  };
  const client = {
    from: (table: string) => {
      const call = { table, filters: [] };
      calls.push(call);
      return chain(call);
    },
    rpc: (fn: string, args: unknown) => {
      calls.push({ fn, args, filters: [] });
      return Promise.resolve(reply);
    },
  } as unknown as SupabaseClient;
  return { client, calls };
};

const hit = { rule_id: "R-SUB-004", rank: 1.6, matched: 2, asked: 4 };

const row = {
  id: "e1", rule_id: "R-SUB-004", version: 1, topic: "print", article_codes: [], scope_methods: [SUBLIMATION],
  scope_note: "scope not reviewed by a factory", title: "Seam crossings", rule: "r", body: "b", best_practice: "bp",
  source: "standard", source_note: "Sublimation practice", status: "draft", confirmed_name: null, confirmed_role: null,
  confirmed_at: null, created_at: "2026-11-01T00:00:00Z",
};

describe("the search", () => {
  it("asks the database for the question, the scope and the limit, and reads the scores back", async () => {
    const found = fake({ data: [hit] });
    expect(await searchRulebook(found.client, "crest near a seam?", { articleCode: "JSY-SS-01", method: SUBLIMATION }, 4)).toEqual([
      { ruleId: "R-SUB-004", rank: 1.6, matched: 2, asked: 4 },
    ]);
    expect(found.calls[0]).toMatchObject({
      fn: "rulebook_search",
      args: { p_query: "crest near a seam?", p_article_code: "JSY-SS-01", p_method: SUBLIMATION, p_limit: 4 },
    });
  });

  it("sends nothing in place of a scope that was not given, so the database matches every rule", async () => {
    const found = fake({ data: [] });
    expect(await searchRulebook(found.client, "anything", {})).toEqual([]);
    expect(found.calls[0]!.args).toMatchObject({ p_article_code: null, p_method: null });
  });

  it("cuts a question far longer than the box allows rather than sending all of it", async () => {
    const found = fake({ data: [] });
    await searchRulebook(found.client, "x".repeat(900), {});
    expect((found.calls[0]!.args as { p_query: string }).p_query).toHaveLength(500);
  });

  it("fails plainly when the database does", async () => {
    await expect(searchRulebook(fake({ error: { message: "no" } }).client, "q", {})).rejects.toThrow();
  });
});

describe("reading the versions of the rules the search found", () => {
  it("reads them by rule id, in order, without the account behind a confirmation", async () => {
    const found = fake({ data: [row] });
    const entries = await versionsOfRules(found.client, ["R-SUB-004"]);
    expect(entries[0]).toMatchObject({ ruleId: "R-SUB-004", methods: [SUBLIMATION], sourceNote: "Sublimation practice" });
    expect(found.calls[0]!.select).not.toContain("confirmed_by");
    expect(found.calls[0]!.select).toContain("scope_methods");
    expect(found.calls[0]!.filters).toEqual([["in", "rule_id", ["R-SUB-004"]], ["order", "rule_id"], ["order", "version"]]);
  });

  it("asks the database nothing at all when the search found nothing", async () => {
    const found = fake({ data: [row] });
    expect(await versionsOfRules(found.client, [])).toEqual([]);
    expect(found.calls).toEqual([]);
  });

  it("fails plainly when the database does", async () => {
    await expect(versionsOfRules(fake({ error: { message: "no" } }).client, ["R-SUB-004"])).rejects.toThrow();
  });
});

describe("retrieval over the database", () => {
  it("joins the two reads together behind the one port the answering path depends on", async () => {
    const found = fake({ data: [hit] });
    const retrieval = databaseRetrieval(found.client);
    expect(await retrieval.search("q", { method: SUBLIMATION }, 6)).toHaveLength(1);
    expect(await retrieval.versions([])).toEqual([]);
    expect(found.calls.map((call) => call.fn ?? call.table)).toEqual(["rulebook_search"]);
  });
});
