import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadHistory, loadNames, loadStored } from "./store";

type Answer = { data?: unknown; error?: { message: string } | null };
const chain = (answer: Answer) => {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order"]) q[m] = () => q;
  q.limit = () => Promise.resolve({ data: answer.data ?? null, error: answer.error ?? null });
  q.then = (resolve: (v: unknown) => unknown) => resolve({ data: answer.data ?? null, error: answer.error ?? null });
  return q;
};
const client = (answer: Answer, users: Record<string, string> = {}) =>
  ({
    from: () => chain(answer),
    auth: { admin: { getUserById: async (id: string) => ({ data: { user: users[id] ? { email: users[id] } : null } }) } },
  }) as unknown as SupabaseClient;

describe("loadStored", () => {
  it("keys the rows by setting", async () => {
    const rows = [{ key: "guardrails.bleed_mm", value: 15, set_by: "u1", set_at: "2026-10-27T00:00:00Z" }];
    expect(await loadStored(client({ data: rows }))).toEqual({ "guardrails.bleed_mm": { value: 15, setBy: "u1", setAt: "2026-10-27T00:00:00Z" } });
  });

  it("is empty with no rows and throws a generic error on a failed read", async () => {
    expect(await loadStored(client({ data: [] }))).toEqual({});
    await expect(loadStored(client({ error: { message: "x" } }))).rejects.toMatchObject({ code: "internal" });
  });
});

describe("loadHistory", () => {
  it("returns the lines as read", async () => {
    const rows = [{ id: "h1", value: null, set_by: null, set_at: "2026-10-27T00:00:00Z" }];
    expect(await loadHistory(client({ data: rows }), "guardrails.bleed_mm")).toEqual([{ id: "h1", value: null, setBy: null, setAt: "2026-10-27T00:00:00Z" }]);
  });

  it("throws on a failed read", async () => {
    await expect(loadHistory(client({ error: { message: "x" } }), "k")).rejects.toMatchObject({ code: "internal" });
  });
});

describe("loadNames", () => {
  it("names people by their address, once each, and skips people it cannot find", async () => {
    expect(await loadNames(client({}, { u1: "ada@example.com" }), ["u1", "u1", "u2"])).toEqual({ u1: "ada@example.com" });
  });
});
