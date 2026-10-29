import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { confirmEntry, loadEntries, loadGaps, logGap, NEEDS_A_PERSON, resolveRule, rulesFor, saveEntry } from "./store";

const confirmInput = { ruleId: "R-SUB-004", version: 1, confirmedName: "Ana Lima", confirmedRole: "pattern master" };

type Answer = { data?: unknown; error?: { message: string; code?: string } | null };
type Call = { table?: string; fn?: string; args?: unknown; select?: string; filters: unknown[] };

/** A stand-in client that records what was asked and gives one answer. */
const fake = (answer: Answer) => {
  const calls: Call[] = [];
  const reply = { data: answer.data ?? null, error: answer.error ?? null };
  const chain = (call: Call) => {
    const q: Record<string, unknown> = {};
    q.select = (cols: string) => ((call.select = cols), q);
    for (const m of ["eq", "order", "limit"]) q[m] = (...a: unknown[]) => (call.filters.push([m, ...a]), q);
    q.maybeSingle = () => Promise.resolve(reply);
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

const row = {
  id: "e1", rule_id: "R-SUB-004", version: 2, topic: "print", article_codes: [], scope_methods: ["sublimation"],
  scope_note: "scope not reviewed by a factory", title: "Seam crossings", rule: "r", body: "b", best_practice: "bp",
  source: "standard", source_note: "Sublimation practice", status: "draft", confirmed_name: null, confirmed_role: null,
  confirmed_at: null, created_at: "2026-11-01T00:00:00Z",
};

const signed = { status: "confirmed", confirmed_at: "2026-11-02T10:00:00Z", confirmed_name: "Ana Lima", confirmed_role: "pattern master" };

describe("reads", () => {
  it("reads every version, leaving out who confirmed unless the server asks", async () => {
    const plain = fake({ data: [row] });
    const entries = await loadEntries(plain.client);
    expect(entries[0]).toMatchObject({ ruleId: "R-SUB-004", version: 2, confirmedBy: null, sourceNote: "Sublimation practice" });
    expect(plain.calls[0]!.select).not.toContain("confirmed_by");

    const server = fake({ data: [{ ...row, confirmed_by: "u1" }] });
    expect((await loadEntries(server.client, true))[0]!.confirmedBy).toBe("u1");
    expect(server.calls[0]!.select).toContain("confirmed_by");
  });

  it("resolves an id to the version its reader may see, out of every version it has", async () => {
    const found = fake({ data: [row, { ...row, id: "e0", version: 1, ...signed }] });
    expect(await resolveRule(found.client, "R-SUB-004", "member")).toMatchObject({
      shown: { version: 1, confirmedName: "Ana Lima", confirmedRole: "pattern master" },
      newerDraft: { version: 2 },
      newest: { version: 2 },
    });
    expect(found.calls[0]!.filters).toEqual([["eq", "rule_id", "R-SUB-004"], ["order", "version", { ascending: false }]]);
    expect(found.calls[0]!.select).toContain("scope_methods");

    const team = fake({ data: [row, { ...row, id: "e0", version: 1, ...signed }] });
    expect(await resolveRule(team.client, "R-SUB-004", "ops")).toMatchObject({ shown: { version: 2 }, newerDraft: null });

    expect(await resolveRule(fake({ data: [] }).client, "R-NONE-999")).toEqual({ shown: null, newerDraft: null, newest: null });
  });

  it("does not ask the database about something that is not a rule id", async () => {
    const none = fake({ data: [row] });
    expect(await resolveRule(none.client, "drop table")).toEqual({ shown: null, newerDraft: null, newest: null });
    expect(none.calls).toEqual([]);
  });

  it("filters the rules for an article, a method and a topic, for the reader asking", async () => {
    const rows = [
      { ...row, ...signed },
      { ...row, id: "e2", rule_id: "R-PAT-001", topic: "pattern", article_codes: ["JSY-SS-01"], scope_methods: [], scope_note: "", ...signed },
    ];
    expect((await rulesFor(fake({ data: rows }).client, { topic: "pattern" })).map((r) => r.ruleId)).toEqual(["R-PAT-001"]);
    expect((await rulesFor(fake({ data: rows }).client, { method: "sublimation" })).map((r) => r.ruleId)).toEqual(["R-SUB-004"]);
    // A member sees nothing the factory has not confirmed, whatever the filter asks for.
    expect(await rulesFor(fake({ data: [row] }).client, {}, "member")).toEqual([]);
    expect((await rulesFor(fake({ data: [row] }).client, {}, "ops")).map((r) => r.ruleId)).toEqual(["R-SUB-004"]);
  });

  it("reads the gaps", async () => {
    const gaps = await loadGaps(fake({ data: [{ code: "R-NONE-999", context: "x", count: 3, first_seen: "a", last_seen: "b" }] }).client);
    expect(gaps).toEqual([{ code: "R-NONE-999", context: "x", count: 3, firstSeen: "a", lastSeen: "b" }]);
  });

  it("reads an empty rulebook as nothing, not as a failure", async () => {
    const empty = fake({ data: null });
    expect(await loadEntries(empty.client)).toEqual([]);
    expect(await resolveRule(fake({ data: null }).client, "R-SUB-004")).toEqual({ shown: null, newerDraft: null, newest: null });
    expect(await loadGaps(fake({ data: null }).client)).toEqual([]);
  });

  it("throws a generic error on a failed read", async () => {
    const broken = fake({ error: { message: "x" } }).client;
    await expect(loadEntries(broken)).rejects.toMatchObject({ code: "internal" });
    await expect(resolveRule(broken, "R-SUB-004")).rejects.toMatchObject({ code: "internal" });
    await expect(loadGaps(broken)).rejects.toMatchObject({ code: "internal" });
  });
});

describe("writes", () => {
  const input = {
    ruleId: "R-SUB-009", topic: "print" as const, articleCodes: [], methods: ["sublimation"],
    scopeNote: "scope not reviewed by a factory", title: "t", rule: "r", body: "b", bestPractice: "bp",
    source: "supplier" as const, sourceNote: "Supplier price lists, May 2026",
  };

  it("logs a gap, cut to the lengths the table takes", async () => {
    const f = fake({});
    await logGap(f.client, { code: "C".repeat(300), context: "x".repeat(600) });
    expect(f.calls[0]).toMatchObject({ fn: "rulebook_gap_log", args: { p_code: "C".repeat(200), p_context: "x".repeat(500) } });
    await expect(logGap(fake({ error: { message: "x" } }).client, { code: "a", context: "" })).rejects.toMatchObject({ code: "internal" });
  });

  it("saves a new version and returns its number", async () => {
    const f = fake({ data: 3 });
    expect(await saveEntry(f.client, "u1", input)).toBe(3);
    expect(f.calls[0]).toMatchObject({
      fn: "rulebook_entry_save",
      args: { p_actor: "u1", p_rule_id: "R-SUB-009", p_scope_methods: ["sublimation"], p_scope_note: "scope not reviewed by a factory", p_source: "supplier" },
    });
  });

  it("confirms a version, naming the factory person who reviewed it (owner decision 14)", async () => {
    const f = fake({});
    await confirmEntry(f.client, "u1", { ruleId: "R-SUB-004", version: 2, confirmedName: "Ana Lima", confirmedRole: "pattern master" });
    expect(f.calls[0]).toMatchObject({
      fn: "rulebook_entry_confirm",
      args: { p_actor: "u1", p_rule_id: "R-SUB-004", p_version: 2, p_name: "Ana Lima", p_role: "pattern master" },
    });
  });

  it("passes on the database's refusal of a confirmation that names nobody", async () => {
    const refused = fake({ error: { message: "names nobody", code: "P0001" } }).client;
    await expect(confirmEntry(refused, "u1", confirmInput)).rejects.toMatchObject({ code: "invalid_input", message: NEEDS_A_PERSON });
  });

  it("answers 'not found' to someone who is not a platform admin, and a generic error otherwise", async () => {
    const refused = fake({ error: { message: "Not found.", code: "P0002" } }).client;
    await expect(saveEntry(refused, "u2", input)).rejects.toMatchObject({ code: "not_found" });
    await expect(confirmEntry(refused, "u2", confirmInput)).rejects.toMatchObject({ code: "not_found" });
    await expect(confirmEntry(fake({ error: { message: "x" } }).client, "u1", confirmInput)).rejects.toMatchObject({ code: "internal" });
  });
});
