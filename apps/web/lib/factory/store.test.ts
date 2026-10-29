import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { allRows, factoryRow, ids } from "./fixtures/rows";
import { FACTORY_TABLES, supabaseFactoryStore } from "./store";

/**
 * The Supabase side of the factory tables. The client is a stand-in that records the calls, so the columns
 * asked for, the filters and the words a refusal is turned into are all held to what the schema allows.
 */

type Call = { table: string; columns?: string; eq?: [string, string]; update?: Record<string, unknown>; insert?: Record<string, unknown> };
type Answer = { data?: unknown; error?: { code?: string; message: string } };

const stub = (answers: Partial<Record<string, Answer>> = {}, fallback: Answer = {}) => {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const call: Call = { table };
      calls.push(call);
      const answer = answers[table] ?? fallback;
      const result = { data: answer.data ?? null, error: answer.error ?? null };
      const query: Record<string, unknown> = {
        select: (columns: string) => {
          call.columns = columns;
          return query;
        },
        eq: (column: string, value: string) => {
          call.eq = [column, value];
          return query;
        },
        update: (columns: Record<string, unknown>) => {
          call.update = columns;
          return query;
        },
        insert: (columns: Record<string, unknown>) => {
          call.insert = columns;
          return query;
        },
        then: (resolve: (v: unknown) => unknown) => resolve(result),
      };
      return query;
    },
  } as unknown as SupabaseClient;
  return { calls, store: supabaseFactoryStore(client) };
};

const refusal = async (promise: Promise<unknown>): Promise<AppError> => {
  const error = await promise.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(AppError);
  return error as AppError;
};

describe("FACTORY_TABLES", () => {
  it("names the six tables of the migration, and nothing else", () => {
    expect([...FACTORY_TABLES]).toEqual(["factories", "factory_capabilities", "price_tiers", "programme_fabrics", "programme_fabric_colours", "country_rules"]);
  });
});

describe("reads", () => {
  it("lists factories by slug, asking only for the columns the app parses", async () => {
    const { calls, store } = stub({ factories: { data: [factoryRow, { ...factoryRow, id: ids.au, slug: "another-partner" }] } });
    expect((await store.listFactories()).map((f) => f.slug)).toEqual(["another-partner", "sialkot-partner"]);
    expect(calls[0]?.columns).toContain("time_zone");
    expect(calls[0]?.columns).not.toContain("*");
  });

  it("finds a factory by its slug, and answers nothing for one that is not there", async () => {
    const { calls, store } = stub({ factories: { data: [factoryRow] } });
    expect((await store.factoryBySlug("sialkot-partner"))?.id).toBe(ids.factory);
    expect(calls[0]?.eq).toEqual(["slug", "sialkot-partner"]);
    const empty = stub({ factories: { data: [] } });
    expect(await empty.store.factoryBySlug("nobody")).toBeNull();
  });

  it("builds a snapshot of one factory: its capabilities, their tiers only, and the fabric cards", async () => {
    const { store } = stub({
      factories: { data: [factoryRow] },
      factory_capabilities: { data: allRows.factory_capabilities },
      price_tiers: { data: [...allRows.price_tiers, { ...allRows.price_tiers[0]!, id: ids.us, capability_id: ids.gb }] },
      programme_fabrics: { data: allRows.programme_fabrics },
    });
    const snapshot = await store.snapshot((await store.factoryBySlug("sialkot-partner"))!);
    expect(snapshot.capabilities).toHaveLength(2);
    expect(snapshot.tiers).toHaveLength(4);
    expect(snapshot.fabrics.map((f) => f.code)).toEqual(["F-POLY-INT", "F-STK-TEE"]);
  });

  it("sorts the fabric programme by code and the country rules by country", async () => {
    const { store } = stub({
      programme_fabrics: { data: [...allRows.programme_fabrics].reverse() },
      country_rules: { data: [...allRows.country_rules].reverse() },
      programme_fabric_colours: { data: allRows.programme_fabric_colours },
    });
    expect((await store.listFabrics()).map((f) => f.code)).toEqual(["F-POLY-INT", "F-STK-TEE"]);
    expect((await store.listCountryRules()).map((r) => r.country)).toEqual(["AU", "GB", "US"]);
    expect((await store.listColours()).map((c) => c.name)).toEqual(["Navy"]);
  });

  it("reads one capability's ladder, and which capability a tier belongs to", async () => {
    const { calls, store } = stub({ price_tiers: { data: [allRows.price_tiers[0]!] } });
    expect(await store.ladder(ids.jersey)).toHaveLength(1);
    expect(calls[0]?.eq).toEqual(["capability_id", ids.jersey]);
    expect(await store.capabilityOfTier(ids.tier10)).toBe(ids.jersey);
    const empty = stub({ price_tiers: { data: [] } });
    expect(await empty.store.capabilityOfTier(ids.tier10)).toBeNull();
  });

  it("asks for every column when the ops page needs the raw row", async () => {
    const { calls, store } = stub({ country_rules: { data: allRows.country_rules } });
    expect(await store.rawRows("country_rules")).toHaveLength(3);
    expect(calls[0]?.columns).toBe("*");
  });

  it("turns a failed read into an internal error without leaking the database's words", async () => {
    const { store } = stub({}, { error: { message: "relation does not exist" } });
    const error = await refusal(store.listFactories());
    expect(error.code).toBe("internal");
    expect(error.message).not.toContain("relation");
  });
});

describe("writes", () => {
  it("records who changed a row and when, and asks the database to confirm the row existed", async () => {
    const { calls, store } = stub({ factory_capabilities: { data: [{ id: ids.jersey }] } });
    await store.update("factory_capabilities", ids.jersey, { moq: 5 }, "actor-1");
    expect(calls[0]?.update).toMatchObject({ moq: 5, updated_by: "actor-1" });
    expect(typeof calls[0]?.update?.updated_at).toBe("string");
    expect(calls[0]?.eq).toEqual(["id", ids.jersey]);
  });

  it("says not found when no row was changed", async () => {
    const { store } = stub({ factory_capabilities: { data: [] } });
    expect((await refusal(store.update("factory_capabilities", ids.jersey, { moq: 5 }, "a"))).code).toBe("not_found");
  });

  it("explains a broken rule, a repeat and a missing link in words", async () => {
    for (const [code, words] of [["23514", "breaks a rule"], ["23505", "already exists"], ["23503", "does not exist"]] as const) {
      const { store } = stub({ price_tiers: { error: { code, message: "x" } } });
      expect((await refusal(store.addTier({ capabilityId: ids.jersey, qtyMin: 1, qtyMax: 9, label: "Test" }, "a"))).message, code).toContain(words);
    }
  });

  it("adds a tier with its quantities and its source line, and nothing else", async () => {
    const { calls, store } = stub({ price_tiers: { data: [{ id: ids.tier10 }] } });
    await store.addTier({ capabilityId: ids.jersey, qtyMin: 1, qtyMax: 9, label: "Test row" }, "actor-1");
    expect(calls[0]?.insert).toEqual({ capability_id: ids.jersey, qty_min: 1, qty_max: 9, label: "Test row", updated_by: "actor-1" });
  });
});
