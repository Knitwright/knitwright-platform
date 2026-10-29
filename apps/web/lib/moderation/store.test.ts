import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { createSupabaseStore } from "./store";
import { verdictOf, reason } from "./types";

const BRAND = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const ASSET = "33333333-3333-4333-8333-333333333333";

type Reply = { data: unknown; error: { message: string; code?: string; hint?: string } | null };

/** A client whose table reads answer as told and whose chain records its filters; `rpc` records its calls. */
function client(tables: Record<string, Reply> = {}, rpcReply: Reply = { data: null, error: null }) {
  const filters: string[] = [];
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const fake = {
    from: (table: string) => {
      const reply = tables[table] ?? { data: [], error: null };
      const q: Record<string, unknown> = {};
      for (const m of ["select", "order", "limit", "eq", "in", "is", "neq"]) {
        q[m] = (...a: unknown[]) => (filters.push(`${m}:${String(a[0])}${a.length > 1 ? `=${String(a[1])}` : ""}`), q);
      }
      q.then = (ok: (r: Reply) => unknown) => Promise.resolve(reply).then(ok);
      return q;
    },
    rpc: async (fn: string, args: Record<string, unknown>) => (calls.push({ fn, args }), rpcReply),
  } as unknown as SupabaseClient;
  return { store: createSupabaseStore(fake), filters, calls };
}

describe("reading the registry", () => {
  it("reads only the marks that are switched on, in the screens' shape", async () => {
    const rows = [
      { id: "1", holder: "Nike, Inc.", mark_text: "Nike", image_hash: null },
      { id: "2", holder: "Picture only", mark_text: null, image_hash: "f".repeat(32) },
    ];
    const { store, filters } = client({ rights_holder_marks: { data: rows, error: null } });
    expect(await store.marks()).toEqual([
      { id: "1", holder: "Nike, Inc.", markText: "Nike", imageHash: null },
      { id: "2", holder: "Picture only", markText: null, imageHash: "f".repeat(32) },
    ]);
    expect(filters).toContain("eq:active=true");
  });

  it("answers with no marks when the table is empty", async () => {
    const { store } = client({ rights_holder_marks: { data: null, error: null } });
    expect(await store.marks()).toEqual([]);
  });

  it("says a read failure in words", async () => {
    const { store } = client({ rights_holder_marks: { data: null, error: { message: "down" } } });
    await expect(store.marks()).rejects.toBeInstanceOf(AppError);
  });
});

describe("keeping a result", () => {
  const verdict = verdictOf([reason("brand_term", "flag", "A brand name.", "Nike")]);

  it("calls the database function with the result and the reasons, and answers with the new id", async () => {
    const { store, calls } = client({}, { data: "check-1", error: null });
    expect(await store.record({ brandId: BRAND, userId: USER, targetKind: "asset", targetId: ASSET, hook: "upload", label: "crest.png", subjectSha256: null, verdict })).toBe("check-1");
    expect(calls[0]!.fn).toBe("moderation_record");
    expect(calls[0]!.args).toMatchObject({ p_brand_id: BRAND, p_user_id: USER, p_target_kind: "asset", p_target_id: ASSET, p_hook: "upload", p_result: "flagged" });
    expect(calls[0]!.args.p_reasons).toHaveLength(1);
  });

  it("cuts a very long label and a very long list of reasons down to what the table takes", async () => {
    const many = verdictOf(Array.from({ length: 25 }, (_, i) => reason("brand_term", "flag", `Reason ${i}`)));
    const { store, calls } = client({}, { data: "check-1", error: null });
    await store.record({ brandId: BRAND, userId: null, targetKind: "text", targetId: null, hook: "text", label: "x".repeat(900), subjectSha256: null, verdict: many });
    expect(String(calls[0]!.args.p_label)).toHaveLength(500);
    expect(calls[0]!.args.p_reasons).toHaveLength(20);
  });

  it("says a write failure in words", async () => {
    const { store } = client({}, { data: null, error: { message: "nope", code: "P0002" } });
    await expect(store.record({ brandId: BRAND, userId: USER, targetKind: "text", targetId: null, hook: "text", label: "", subjectSha256: null, verdict })).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("the latest result of each target", () => {
  it("keeps the newest row per target and asks for the right kind", async () => {
    const rows = [
      { target_id: ASSET, seq: 9, result: "flagged", decision: null },
      { target_id: ASSET, seq: 3, result: "clear", decision: null },
      { target_id: BRAND, seq: 7, result: "blocked", decision: "blocked" },
    ];
    const { store, filters } = client({ moderation_checks: { data: rows, error: null } });
    expect(await store.latest("asset", [ASSET, BRAND])).toEqual([
      { targetId: ASSET, result: "flagged", decision: null },
      { targetId: BRAND, result: "blocked", decision: "blocked" },
    ]);
    expect(filters).toContain("eq:target_kind=asset");
  });

  it("asks nothing when there are no ids", async () => {
    const { store, filters } = client();
    expect(await store.latest("asset", [])).toEqual([]);
    expect(filters).toEqual([]);
  });

  it("says a read failure in words", async () => {
    const { store } = client({ moderation_checks: { data: null, error: { message: "down" } } });
    await expect(store.latest("asset", [ASSET])).rejects.toBeInstanceOf(AppError);
  });
});

describe("whether a person has allowed a target", () => {
  it("asks the database function, and treats anything but true as no", async () => {
    const yes = client({}, { data: true, error: null });
    expect(await yes.store.humanAllowed("version", ASSET)).toBe(true);
    expect(yes.calls[0]).toMatchObject({ fn: "moderation_human_allowed", args: { p_target_kind: "version", p_target_id: ASSET } });
    expect(await client({}, { data: null, error: null }).store.humanAllowed("version", ASSET)).toBe(false);
  });

  it("says a failure in words rather than answering no", async () => {
    const { store } = client({}, { data: null, error: { message: "down" } });
    await expect(store.humanAllowed("version", ASSET)).rejects.toBeInstanceOf(AppError);
  });
});
