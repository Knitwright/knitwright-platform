import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { buildSeedTemplates } from "./seed/build";
import { rowOf } from "./seed/seed";
import { createFromTemplate, loadLibrary, loadSnapshots } from "./service";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const seed = buildSeedTemplates()[0]!;
const stored = { id: "22222222-2222-4222-8222-222222222222", ...rowOf(seed) };

function readClient(rows: unknown[], error: { message: string } | null = null) {
  const query = {
    select: () => query,
    order: () => query,
    limit: async () => ({ data: rows, error }),
    in: async () => ({ data: rows, error }),
    eq: () => query,
    maybeSingle: async () => ({ data: rows[0] ?? null, error }),
  };
  return { from: () => query } as unknown as SupabaseClient;
}

function adminClient(result: { data: unknown; error: { message: string; code?: string } | null }) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const client = { rpc: async (fn: string, args: Record<string, unknown>) => (calls.push({ fn, args }), result) } as unknown as SupabaseClient;
  return { client, calls };
}

describe("reading the library", () => {
  it("turns rows into summaries, without the design", async () => {
    const [summary] = await loadLibrary(readClient([stored]));
    expect(summary).toEqual({
      id: stored.id,
      slug: seed.slug,
      title: seed.title,
      sport: seed.sport,
      articleId: seed.articleId,
      style: seed.style,
      styleTags: [seed.style],
      colourFamily: seed.colourFamily,
      reviewState: "not_reviewed",
    });
    expect(summary).not.toHaveProperty("snapshot");
  });

  it("reports a failed read, and a row it cannot read", async () => {
    await expect(loadLibrary(readClient([], { message: "boom" }))).rejects.toBeInstanceOf(AppError);
    await expect(loadLibrary(readClient([{ id: "not-a-uuid" }]))).rejects.toBeInstanceOf(AppError);
  });

  it("reports a failed or unreadable read of designs", async () => {
    await expect(loadSnapshots(readClient([], { message: "boom" }), [stored.id])).rejects.toBeInstanceOf(AppError);
    await expect(loadSnapshots(readClient([{ id: "no" }]), [stored.id])).rejects.toBeInstanceOf(AppError);
  });

  it("reads the designs of the page shown by id", async () => {
    const map = await loadSnapshots(readClient([{ id: stored.id, snapshot: stored.snapshot }]), [stored.id]);
    expect(map.get(stored.id)).toEqual(stored.snapshot);
    expect((await loadSnapshots(readClient([]), [])).size).toBe(0);
  });
});

describe("using a template", () => {
  const who = { brandId: "33333333-3333-4333-8333-333333333333", userId: "44444444-4444-4444-8444-444444444444" };

  it("makes a new design as version 1 through create_project, from a copy of the snapshot", async () => {
    const { client, calls } = adminClient({ data: PROJECT_ID, error: null });
    const id = await createFromTemplate(client, readClient([stored]), { ...who, templateId: stored.id });
    expect(id).toBe(PROJECT_ID);
    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.fn).toBe("create_project");
    expect(call.args).toMatchObject({
      p_brand_id: who.brandId,
      p_user_id: who.userId,
      p_name: seed.title,
      p_garment_type: seed.articleId,
    });
    expect(call.args.p_spec).toEqual(stored.snapshot);
    expect(call.args.p_spec).not.toBe(stored.snapshot);
  });

  it("says the template is not found when the library has no such row", async () => {
    const { client, calls } = adminClient({ data: PROJECT_ID, error: null });
    await expect(createFromTemplate(client, readClient([]), { ...who, templateId: stored.id })).rejects.toMatchObject({ code: "not_found" });
    expect(calls).toEqual([]);
  });

  it("refuses a template whose design cannot be read, and stores nothing", async () => {
    const { client, calls } = adminClient({ data: PROJECT_ID, error: null });
    await expect(createFromTemplate(client, readClient([{ ...stored, snapshot: { typeId: "x" } }]), { ...who, templateId: stored.id })).rejects.toMatchObject({
      code: "unavailable",
    });
    expect(calls).toEqual([]);
  });

  it("reports a failed read of the template", async () => {
    const { client } = adminClient({ data: PROJECT_ID, error: null });
    await expect(createFromTemplate(client, readClient([], { message: "boom" }), { ...who, templateId: stored.id })).rejects.toBeInstanceOf(AppError);
  });

  it("passes on a database refusal", async () => {
    const { client } = adminClient({ data: null, error: { message: "nope" } });
    await expect(createFromTemplate(client, readClient([stored]), { ...who, templateId: stored.id })).rejects.toBeInstanceOf(AppError);
  });
});
