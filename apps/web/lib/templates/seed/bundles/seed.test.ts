import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { buildBundles } from "./build";
import { seedKitBundles } from "./seed";

type Call = { table: string; op: string; arg?: unknown; options?: unknown };

function fakeAdmin(fail?: "bundles" | "clear" | "members") {
  const calls: Call[] = [];
  const failed = (table: string, op: string) =>
    (fail === "bundles" && op === "upsert") || (fail === "clear" && op === "delete") || (fail === "members" && op === "insert")
      ? { message: `${table} ${op} failed` }
      : null;
  const client = {
    from: (table: string) => ({
      upsert: async (arg: unknown, options: unknown) => {
        calls.push({ table, op: "upsert", arg, options });
        return { error: failed(table, "upsert") };
      },
      delete: () => ({
        in: async (_column: string, arg: unknown) => {
          calls.push({ table, op: "delete", arg });
          return { error: failed(table, "delete") };
        },
      }),
      insert: async (arg: unknown) => {
        calls.push({ table, op: "insert", arg });
        return { error: failed(table, "insert") };
      },
    }),
  };
  return { client: client as unknown as SupabaseClient, calls };
}

describe("seeding the kit bundles", () => {
  it("writes each bundle by slug, then its members from scratch", async () => {
    const { client, calls } = fakeAdmin();
    const bundles = buildBundles();

    expect(await seedKitBundles(client)).toBe(bundles.length);
    expect(calls.map((call) => `${call.table}:${call.op}`)).toEqual([
      "template_kit_bundles:upsert",
      "template_kit_bundle_members:delete",
      "template_kit_bundle_members:insert",
    ]);
    expect(calls[0]!.options).toEqual({ onConflict: "slug" });
    expect((calls[0]!.arg as { slug: string }[]).map((row) => row.slug)).toEqual(bundles.map((bundle) => bundle.slug));
    expect(calls[1]!.arg).toEqual(bundles.map((bundle) => bundle.slug));
    expect(calls[2]!.arg).toHaveLength(bundles.reduce((total, bundle) => total + bundle.members.length, 0));
  });

  it("reports a failure at any of the three steps", async () => {
    await expect(seedKitBundles(fakeAdmin("bundles").client)).rejects.toThrow("template_kit_bundles upsert failed");
    await expect(seedKitBundles(fakeAdmin("clear").client)).rejects.toThrow("template_kit_bundle_members delete failed");
    await expect(seedKitBundles(fakeAdmin("members").client)).rejects.toThrow("template_kit_bundle_members insert failed");
  });
});
