import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { COLOUR_FAMILIES } from "@/lib/templates/colour-family";
import { SPORTS } from "@/lib/templates/catalogue";
import { mockupSceneSchema, sceneFromSnapshot } from "./schemas";
import { ALL_MOCKUP_SCENES, sceneBySlug } from "./scenes";
import { mockupSceneRow, mockupSceneRows, seedMockupScenes } from "./seed";
import { loadMockupScene, loadMockupScenes } from "./service";

/**
 * How a scene is stored and read back: the `templates` row of kind `mockup_scene`, the schema that
 * is the one door out of the database, and the seed that is the one writer.
 *
 * The database's own behaviour -- the grants, the row level security, and that a browser cannot write
 * a scene -- is `tests/integration/mockup-scenes.test.ts`, which CI runs.
 */

const stored = (slug: string, over: Record<string, unknown> = {}) => ({
  id: "22222222-2222-4222-8222-222222222222",
  slug,
  title: "A scene",
  snapshot: sceneBySlug(slug),
  review_state: "not_reviewed",
  ...over,
});

function readClient(rows: unknown[], error: { message: string } | null = null) {
  const asked: { table?: string; filters: [string, unknown][] } = { filters: [] };
  const query = {
    select: () => query,
    order: () => query,
    eq: (column: string, value: unknown) => (asked.filters.push([column, value]), query),
    limit: async () => ({ data: rows, error }),
    maybeSingle: async () => ({ data: rows[0] ?? null, error }),
  };
  return { client: { from: (table: string) => ((asked.table = table), query) } as unknown as SupabaseClient, asked };
}

function writeClient(reviewed: { slug: string }[] = [], failures: { read?: string; write?: string } = {}) {
  const upserts: unknown[][] = [];
  const client = {
    from: () => ({
      select: () => ({ eq: async () => ({ data: reviewed, error: failures.read ? { message: failures.read } : null }) }),
      upsert: async (rows: unknown[]) => (upserts.push(rows), { error: failures.write ? { message: failures.write } : null }),
    }),
  } as unknown as SupabaseClient;
  return { client, upserts };
}

describe("the row a scene is stored as", () => {
  it("uses the columns the templates table really has, and the kind L8 added", () => {
    const row = mockupSceneRow(sceneBySlug("flat-lay-grass")!);
    expect(row.kind).toBe("mockup_scene");
    expect(SPORTS).toContain(row.sport);
    expect(COLOUR_FAMILIES).toContain(row.colour_family);
    expect(row.source).toBe("knitwright");
    expect(row.review_state).toBe("not_reviewed");
    expect(row.era_tags).toEqual([]);
  });

  it("leaves the article and the wearer empty, because a scene is not drawn on one article", () => {
    for (const row of mockupSceneRows()) {
      expect(row.article_id, row.slug).toBeNull();
      expect(row.wearer, row.slug).toBeNull();
    }
  });

  it("puts the scene itself in the snapshot, which already carries its grant", () => {
    const scene = sceneBySlug("product-front")!;
    expect(mockupSceneRow(scene).snapshot).toBe(scene);
  });

  it("files the groups the sport column cannot hold under general, with sport_tags carrying them", () => {
    expect(mockupSceneRow(sceneBySlug("dojo-mat")!).sport).toBe("general");
    expect(mockupSceneRow(sceneBySlug("dojo-mat")!).sport_tags).toContain("combat");
    expect(mockupSceneRow(sceneBySlug("rgb-desk")!).sport_tags).toContain("esports");
    expect(mockupSceneRow(sceneBySlug("floodlit-pitch")!).sport).toBe("football");
    expect(mockupSceneRow(sceneBySlug("track-warm-up")!).sport).toBe("training");
    expect(mockupSceneRow(sceneBySlug("finish-line")!).sport).toBe("running");
  });

  it("writes one row per scene, found by its slug, with the group as its style tag", () => {
    expect(mockupSceneRows()).toHaveLength(ALL_MOCKUP_SCENES.length);
    expect(mockupSceneRow(sceneBySlug("shop-rail")!).style_tags).toEqual(["retail"]);
  });
});

describe("seeding the scenes", () => {
  it("writes every scene once", async () => {
    const { client, upserts } = writeClient();
    expect(await seedMockupScenes(client)).toBe(ALL_MOCKUP_SCENES.length);
    expect(upserts[0]).toHaveLength(ALL_MOCKUP_SCENES.length);
  });

  it("leaves a scene a platform admin has reviewed exactly as it is", async () => {
    const { client, upserts } = writeClient([{ slug: "product-front" }]);
    expect(await seedMockupScenes(client)).toBe(ALL_MOCKUP_SCENES.length - 1);
    expect((upserts[0] as { slug: string }[]).map((row) => row.slug)).not.toContain("product-front");
  });

  it("writes nothing when every scene has been reviewed", async () => {
    const { client, upserts } = writeClient(ALL_MOCKUP_SCENES.map((scene) => ({ slug: scene.slug })));
    expect(await seedMockupScenes(client)).toBe(0);
    expect(upserts).toEqual([]);
  });

  it("says what went wrong rather than reporting a write that did not happen", async () => {
    await expect(seedMockupScenes(writeClient([], { read: "no read" }).client)).rejects.toThrow("no read");
    await expect(seedMockupScenes(writeClient([], { write: "no write" }).client)).rejects.toThrow("no write");
  });
});

describe("the schema, which is the one door out of the database", () => {
  it("accepts every scene this workstream seeds", () => {
    for (const scene of ALL_MOCKUP_SCENES) expect(mockupSceneSchema.safeParse(scene).success, scene.slug).toBe(true);
  });

  it("turns a stored snapshot back into a scene", () => {
    const scene = sceneBySlug("product-back")!;
    expect(sceneFromSnapshot(JSON.parse(JSON.stringify(scene)))).toEqual(scene);
  });

  it("answers null for anything that is not a scene, rather than half of one", () => {
    expect(sceneFromSnapshot(null)).toBeNull();
    expect(sceneFromSnapshot({})).toBeNull();
    expect(sceneFromSnapshot({ ...sceneBySlug("product-front")!, slots: [] })).toBeNull();
    expect(sceneFromSnapshot({ ...sceneBySlug("product-front")!, ruleId: "not a rule" })).toBeNull();
    expect(sceneFromSnapshot({ ...sceneBySlug("product-front")!, backdrop: { ...sceneBySlug("product-front")!.backdrop, hex: "white" } })).toBeNull();
  });
});

describe("reading the scenes", () => {
  it("asks the database for mockup scenes and nothing else, which is L8's own warning", async () => {
    const { client, asked } = readClient([stored("product-front")]);
    const read = await loadMockupScenes(client);
    expect(asked.table).toBe("templates");
    expect(asked.filters).toContainEqual(["kind", "mockup_scene"]);
    expect(read.scenes.map((one) => one.scene.slug)).toEqual(["product-front"]);
    expect(read.unreadable).toBe(0);
    expect(read.scenes[0]!.reviewed).toBe(false);
  });

  it("leaves out a row it cannot read, and counts it", async () => {
    const { client } = readClient([stored("product-front"), stored("broken", { snapshot: { nothing: true } })]);
    const read = await loadMockupScenes(client);
    expect(read.scenes).toHaveLength(1);
    expect(read.unreadable).toBe(1);
  });

  it("marks a reviewed scene as reviewed", async () => {
    const { client } = readClient([stored("product-front", { review_state: "reviewed" })]);
    expect((await loadMockupScenes(client)).scenes[0]!.reviewed).toBe(true);
  });

  it("reports a failed read, and a row shaped nothing like a template", async () => {
    await expect(loadMockupScenes(readClient([], { message: "boom" }).client)).rejects.toBeInstanceOf(AppError);
    await expect(loadMockupScenes(readClient([{ id: "not-a-uuid" }]).client)).rejects.toBeInstanceOf(AppError);
  });

  it("finds one scene by its slug, or nothing", async () => {
    const { client, asked } = readClient([stored("product-side")]);
    expect((await loadMockupScene(client, "product-side"))?.scene.slug).toBe("product-side");
    expect(asked.filters).toContainEqual(["slug", "product-side"]);
    expect(await loadMockupScene(readClient([]).client, "gone")).toBeNull();
    expect(await loadMockupScene(readClient([stored("x", { snapshot: 7 })]).client, "x")).toBeNull();
    await expect(loadMockupScene(readClient([], { message: "boom" }).client, "x")).rejects.toBeInstanceOf(AppError);
    await expect(loadMockupScene(readClient([{ id: "nope" }]).client, "x")).rejects.toBeInstanceOf(AppError);
  });
});
