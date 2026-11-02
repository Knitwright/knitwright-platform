import { beforeAll, describe, expect, it } from "vitest";
import { ALL_MOCKUP_SCENES, deterministicScenes } from "@/lib/mockups";
import { mockupSceneRow, seedMockupScenes } from "@/lib/mockups/seed";
import { loadMockupScene, loadMockupScenes } from "@/lib/mockups/service";
import { loadLibrary } from "@/lib/templates/service";
import { seedTemplates } from "@/lib/templates/seed/seed";
import { adminClient, anonClient, must, person, type Person } from "./support";

/**
 * Migration 20261201060000: the mockup scenes of `07` as `templates` rows of kind `mockup_scene`
 * (plan v5 L2, decision 0092).
 *
 * The same rules as `templates` itself: any signed-in user reads them; nobody writes one from a
 * browser, a platform admin included; the server writes through the service client. Two things on top
 * of that are the point of this file:
 *
 *   * **the design library does not see a scene.** `loadLibrary` asks for `kind = 'design'`, which is
 *     the narrowing L8 said had to come with the first row of a second kind, and a scene row would
 *     otherwise fail its parse and take the whole page with it;
 *   * **a design still names its article and its wearer.** Both columns became nullable so a scene
 *     could leave them empty, and `templates_design_names_an_article` keeps them required for a
 *     design.
 *
 * Every test reads. The one write is the seed itself, which is platform data found by slug, so running
 * it again changes the rows it made and adds nothing (plan v5, lesson on the shared database).
 */

let alice: Person;
let admin: Person;

/** The seeded scenes by slug, so a row another test in this file adds cannot change a count. */
const SEEDED = new Set(ALL_MOCKUP_SCENES.map((scene) => scene.slug));

beforeAll(async () => {
  [alice, admin] = await Promise.all([person("mockup-alice"), person("mockup-admin")]);
  must(await adminClient().from("platform_admins").insert({ user_id: admin.userId }).select("user_id"));
  await seedTemplates(adminClient());
  await seedMockupScenes(adminClient());
});

describe("the mockup scenes in the database", () => {
  it("is readable by a signed-in user and refused to a visitor", async () => {
    const read = await loadMockupScenes(alice.client);
    const seeded = read.scenes.filter((one) => SEEDED.has(one.scene.slug));

    expect(seeded).toHaveLength(ALL_MOCKUP_SCENES.length);
    expect(read.unreadable).toBe(0);
    expect(seeded.every((one) => one.reviewed === false)).toBe(true);
    expect((await anonClient().from("templates").select("slug").eq("kind", "mockup_scene")).error).not.toBeNull();
  });

  it("carries the scene itself, so a panel reads the slots, the backdrop and the crops", async () => {
    const found = await loadMockupScene(alice.client, "flat-lay-grass");

    expect(found?.scene.title).toBe("Flat lay on grass");
    expect(found?.scene.backdrop.hex).toBe("#4a7a3c");
    expect(found?.scene.slots).toHaveLength(1);
    expect(found?.scene.ruleId).toBe("R-GAP-000");
    expect(await loadMockupScene(alice.client, "no-such-scene")).toBeNull();
  });

  it("files the deterministic scenes against this workstream and the rest against L3", async () => {
    const read = await loadMockupScenes(alice.client);
    const seeded = read.scenes.filter((one) => SEEDED.has(one.scene.slug));
    const free = seeded.filter((one) => one.scene.source === "deterministic");

    expect(free).toHaveLength(deterministicScenes().length);
    expect(free.every((one) => one.scene.owner === "L2")).toBe(true);
    expect(seeded.filter((one) => one.scene.source === "ai").every((one) => one.scene.owner === "L3")).toBe(true);
  });

  it("leaves the article and the wearer empty, which is why the migration exists", async () => {
    const rows = must(await adminClient().from("templates").select("slug, article_id, wearer").eq("kind", "mockup_scene"));

    expect(rows.filter((row) => SEEDED.has(row.slug))).toHaveLength(ALL_MOCKUP_SCENES.length);
    expect(rows.every((row) => row.article_id === null && row.wearer === null)).toBe(true);
  });

  it("writes the scenes again without adding one", async () => {
    const before = must(await adminClient().from("templates").select("id").eq("kind", "mockup_scene"));
    await seedMockupScenes(adminClient());

    expect(must(await adminClient().from("templates").select("id").eq("kind", "mockup_scene"))).toHaveLength(before.length);
  });
});

describe("the design library and the scenes do not see each other", () => {
  it("shows a signed-in member the designs and not one scene", async () => {
    const library = await loadLibrary(alice.client);

    expect(library.length).toBeGreaterThanOrEqual(60);
    const slugs = new Set(library.map((entry) => entry.slug));
    for (const scene of ALL_MOCKUP_SCENES) expect(slugs.has(scene.slug), scene.slug).toBe(false);
  });
});

describe("what the database refuses", () => {
  it.each([
    ["a member", () => alice],
    ["a platform admin", () => admin],
  ])("refuses a browser write of a scene from %s", async (_who, who) => {
    const row = mockupSceneRow(ALL_MOCKUP_SCENES[0]!);
    const client = who().client;

    expect((await client.from("templates").insert({ ...row, slug: "browser-made-scene" })).error).not.toBeNull();
    expect((await client.from("templates").update({ title: "Changed" }).eq("slug", row.slug)).error).not.toBeNull();
    expect((await client.from("templates").delete().eq("slug", row.slug)).error).not.toBeNull();
  });

  it("still makes a design name its article and its wearer", async () => {
    const once = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const base = { ...mockupSceneRow(ALL_MOCKUP_SCENES[0]!), slug: `design-no-article-${once}`, title: `Design check ${once}` };

    // A design with neither: refused by templates_design_names_an_article.
    expect((await adminClient().from("templates").insert({ ...base, kind: "design" })).error).not.toBeNull();
    // A design with only one of the two: refused as well.
    expect((await adminClient().from("templates").insert({ ...base, kind: "design", article_id: "crew-tee" })).error).not.toBeNull();
    // The same row as a scene: taken, because a scene has garment slots rather than an article.
    must(await adminClient().from("templates").insert(base).select("slug"));
  });
});
