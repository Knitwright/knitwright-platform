import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { buildSeedTemplates } from "./build";
import { rowOf, seedTemplates } from "./seed";

type Call = { table: string; op: string; arg?: unknown; options?: unknown };

function fakeAdmin(reviewed: string[], fail?: "read" | "write") {
  const calls: Call[] = [];
  const client = {
    from: (table: string) => ({
      select: () => ({
        eq: async () => ({ data: fail === "read" ? null : reviewed.map((slug) => ({ slug })), error: fail === "read" ? { message: "read failed" } : null }),
      }),
      upsert: async (arg: unknown, options: unknown) => {
        calls.push({ table, op: "upsert", arg, options });
        return { error: fail === "write" ? { message: "write failed" } : null };
      },
    }),
  };
  return { client: client as unknown as SupabaseClient, calls };
}

describe("seeding the library", () => {
  it("stores a row for each starter, keyed by slug, labelled as not reviewed", async () => {
    const { client, calls } = fakeAdmin([]);
    expect(await seedTemplates(client)).toBe(12);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.options).toEqual({ onConflict: "slug" });
    const rows = calls[0]!.arg as ReturnType<typeof rowOf>[];
    expect(rows.map((entry) => entry.slug)).toEqual(buildSeedTemplates().map((seed) => seed.slug));
    expect(rows.every((entry) => entry.source === "knitwright" && entry.review_state === "not_reviewed")).toBe(true);
  });

  it("leaves a template a person has reviewed as it is", async () => {
    const { client, calls } = fakeAdmin(["navy-gold-hoops"]);
    expect(await seedTemplates(client)).toBe(11);
    expect((calls[0]!.arg as { slug: string }[]).some((entry) => entry.slug === "navy-gold-hoops")).toBe(false);
  });

  it("writes nothing when every row is reviewed", async () => {
    const { client, calls } = fakeAdmin(buildSeedTemplates().map((seed) => seed.slug));
    expect(await seedTemplates(client)).toBe(0);
    expect(calls).toEqual([]);
  });

  it("treats an empty answer as no reviewed rows", async () => {
    const client = { from: () => ({ select: () => ({ eq: async () => ({ data: null, error: null }) }), upsert: async () => ({ error: null }) }) } as unknown as SupabaseClient;
    expect(await seedTemplates(client)).toBe(12);
  });

  it("reports a failed read or write", async () => {
    await expect(seedTemplates(fakeAdmin([], "read").client)).rejects.toThrow("read failed");
    await expect(seedTemplates(fakeAdmin([], "write").client)).rejects.toThrow("write failed");
  });
});
