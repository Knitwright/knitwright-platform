import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { card, runningShort } from "./fixtures/cards";
import { createSupabaseStore, storable } from "./store";

/**
 * The database store: reads go through the client it is given, every write goes through a function only the server's
 * key may run, and `storable` re-checks every card on its way out, so a string with markup in it cannot reach a column
 * even if a caller tries.
 */

const BRAND = "11111111-1111-4111-8111-111111111111";
const WHO = { brandId: BRAND, userId: "22222222-2222-4222-8222-222222222222" };

type Reply = { data: unknown; error: { message: string; code?: string; hint?: string } | null };

function client(tables: Record<string, Reply> = {}, rpcReply: Reply = { data: null, error: null }) {
  const filters: string[] = [];
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const fake = {
    from: (table: string) => {
      const reply = tables[table] ?? { data: [], error: null };
      const q: Record<string, unknown> = {};
      for (const m of ["select", "order", "limit", "eq", "maybeSingle"]) {
        q[m] = (...a: unknown[]) => (filters.push(`${m}:${String(a[0])}${a.length > 1 ? `=${String(a[1])}` : ""}`), q);
      }
      q.then = (ok: (r: Reply) => unknown) => Promise.resolve(reply).then(ok);
      return q;
    },
    rpc: async (fn: string, args: Record<string, unknown>) => (calls.push({ fn, args }), rpcReply),
  } as unknown as SupabaseClient;
  return { store: createSupabaseStore(fake), filters, calls };
}

const ROW = {
  id: "card-1",
  source_kind: "url",
  source_url: "https://example.test/product",
  source_host: "example.test",
  card: runningShort(),
  extractor: "stub",
  confirmed_at: null,
};

describe("storable", () => {
  it("lets a card through unchanged", () => {
    expect(storable(runningShort())).toEqual(runningShort());
  });

  it("refuses a card with markup in it, whatever the caller says", () => {
    const smuggled = { ...runningShort(), productName: { value: "<script>x</script>", provenance: "observed" as const, corrected: false } };

    expect(() => storable(smuggled)).toThrow(AppError);
  });

  it("refuses a card whose field holds a value it says is not known", () => {
    const wrong = { ...card(), fit: { value: "Slim", provenance: "unknown" as const, corrected: false } };

    expect(() => storable(wrong)).toThrow(AppError);
  });
});

describe("writes", () => {
  it("makes a comparison through its own function, with the brand from the session", async () => {
    const { store, calls } = client({}, { data: "benchmark-1", error: null });

    expect(await store.create(WHO, { title: "Running shorts", projectId: null })).toBe("benchmark-1");
    expect(calls[0]).toEqual({
      fn: "benchmark_create",
      args: { p_brand_id: BRAND, p_user_id: WHO.userId, p_project_id: null, p_title: "Running shorts" },
    });
  });

  it("claims a fetch and reads back whether the brand has read the page before", async () => {
    const claimed = client({}, { data: "ok", error: null });
    const already = client({}, { data: "already", error: null });

    expect(await claimed.store.claimFetch(WHO, { urlKey: "a".repeat(64), host: "example.test" })).toBe("ok");
    expect(await already.store.claimFetch(WHO, { urlKey: "a".repeat(64), host: "example.test" })).toBe("already");
  });

  it("says what came of the fetch, so a refused page is never tried again in a loop", async () => {
    const { store, calls } = client();

    await store.settleFetch(WHO, { urlKey: "b".repeat(64), outcome: "robots_refused" });

    expect(calls[0]).toMatchObject({ fn: "benchmark_fetch_settle", args: { p_outcome: "robots_refused" } });
  });

  it("sends the card through storable before it reaches the database", async () => {
    const { store } = client({}, { data: "card-1", error: null });
    const smuggled = { ...runningShort(), fit: { value: "<b>Slim</b>", provenance: "observed" as const, corrected: false } };

    await expect(
      store.addCard(WHO, { benchmarkId: "b1", sourceKind: "url", sourceUrl: "https://example.test/p", sourceHost: "example.test", sourceFileId: null, card: smuggled, extractor: "stub" }),
    ).rejects.toThrow(AppError);
  });

  it("keeps a card with its source URL and the host, and nothing else about the page", async () => {
    const { store, calls } = client({}, { data: "card-1", error: null });

    await store.addCard(WHO, {
      benchmarkId: "b1",
      sourceKind: "url",
      sourceUrl: "https://example.test/p",
      sourceHost: "example.test",
      sourceFileId: null,
      card: runningShort(),
      extractor: "stub",
    });

    expect(Object.keys(calls[0]!.args).sort()).toEqual(
      ["p_benchmark_id", "p_brand_id", "p_card", "p_extractor", "p_source_file_id", "p_source_host", "p_source_kind", "p_source_url", "p_user_id"],
    );
  });

  it("confirms and removes a card through their own functions", async () => {
    const { store, calls } = client();

    await store.confirmCard(WHO, { cardId: "card-1", card: runningShort() });
    await store.removeCard(WHO, "card-1");

    expect(calls.map((call) => call.fn)).toEqual(["benchmark_card_confirm", "benchmark_card_remove"]);
  });

  it("says a refusal in words a person can act on", async () => {
    const tooMany = client({}, { data: null, error: { message: "no", hint: "too_many_cards" } });
    const limited = client({}, { data: null, error: { message: "no", hint: "rate_limited" } });

    await expect(tooMany.store.create(WHO, { title: "x", projectId: null })).rejects.toThrow("5 cards at most");
    await expect(limited.store.create(WHO, { title: "x", projectId: null })).rejects.toThrow("as many competitor pages");
  });
});

describe("reads", () => {
  it("lists a brand's comparisons with how many cards each holds", async () => {
    const rows = [{ id: "b1", title: "Running shorts", project_id: null, created_at: "2026-10-30T00:00:00.000Z", benchmark_cards: [{ count: 3 }] }];
    const { store, filters } = client({ benchmarks: { data: rows, error: null } });

    expect(await store.list(WHO)).toEqual([{ id: "b1", title: "Running shorts", projectId: null, cards: 3, createdAt: "2026-10-30T00:00:00.000Z" }]);
    expect(filters).toContain(`eq:brand_id=${BRAND}`);
  });

  it("counts no cards when the database sends none", async () => {
    const rows = [{ id: "b1", title: "x", project_id: null, created_at: "2026-10-30T00:00:00.000Z", benchmark_cards: [] }];
    const { store } = client({ benchmarks: { data: rows, error: null } });

    expect((await store.list(WHO))[0]?.cards).toBe(0);
  });

  it("reads one comparison with its cards, parsed back into the card shape", async () => {
    const data = { id: "b1", title: "Running shorts", project_id: null, created_at: "2026-10-30T00:00:00.000Z", benchmark_cards: [ROW] };
    const { store, filters } = client({ benchmarks: { data, error: null } });

    const held = await store.read(WHO, "b1");

    expect(held?.cards[0]).toMatchObject({ id: "card-1", sourceKind: "url", sourceHost: "example.test", extractor: "stub" });
    expect(held?.cards[0]?.card.productName.value).toBe("Acme Speedshort 5in");
    expect(filters).toContain("eq:id=b1");
  });

  it("answers with nothing for a comparison of another brand", async () => {
    const { store } = client({ benchmarks: { data: null, error: null } });

    expect(await store.read(WHO, "b1")).toBeNull();
  });

  it("says a read failure in words rather than passing the database's own message on", async () => {
    const { store } = client({ benchmarks: { data: null, error: { message: "down" } } });

    await expect(store.list(WHO)).rejects.toBeInstanceOf(AppError);
  });
});
