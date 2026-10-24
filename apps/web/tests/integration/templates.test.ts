import { beforeAll, describe, expect, it } from "vitest";
import { buildSeedTemplates } from "@/lib/templates/seed/build";
import { seedTemplates } from "@/lib/templates/seed/seed";
import { anonClient, adminClient, must, person, type Person } from "./support";

/**
 * Migration 20261025030000: the template library. Any signed-in user reads it; nobody writes it from a browser,
 * a platform admin included; the server writes through the service client. The designer source is switched off.
 * (Written without a local database to run them on: see the pull request.)
 */

let alice: Person;
let admin: Person;

const row = (slug: string, over: Record<string, unknown> = {}) => {
  const seed = buildSeedTemplates()[0]!;
  return {
    slug,
    title: "Test template",
    sport: seed.sport,
    article_id: seed.articleId,
    wearer: seed.wearer,
    style_tags: [...seed.styleTags],
    colour_family: seed.colourFamily,
    snapshot: seed.snapshot,
    ...over,
  };
};

beforeAll(async () => {
  [alice, admin] = await Promise.all([person("tpl-alice"), person("tpl-admin")]);
  must(await adminClient().from("platform_admins").insert({ user_id: admin.userId }).select("user_id"));
  await seedTemplates(adminClient());
});

describe("the template library in the database", () => {
  it("is readable by a signed-in user and empty to a visitor", async () => {
    const seen = must(await alice.client.from("templates").select("slug, review_state"));
    expect(seen.length).toBeGreaterThanOrEqual(12);
    expect(seen.every((entry) => entry.review_state === "not_reviewed")).toBe(true);
    expect(must(await anonClient().from("templates").select("slug"))).toEqual([]);
  });

  it.each([
    ["a member", () => alice],
    ["a platform admin", () => admin],
  ])("refuses a browser write from %s", async (_who, who) => {
    const client = who().client;
    expect((await client.from("templates").insert(row("browser-made"))).error).not.toBeNull();
    expect((await client.from("templates").update({ title: "Changed" }).eq("slug", "navy-gold-hoops")).error).not.toBeNull();
    expect((await client.from("templates").delete().eq("slug", "navy-gold-hoops")).error).not.toBeNull();
    const { data } = await adminClient().from("templates").select("title").eq("slug", "navy-gold-hoops").single();
    expect(data?.title).toBe("Navy and gold hoops");
  });

  it("lets the server write, and seeding twice adds nothing", async () => {
    const before = must(await adminClient().from("templates").select("id"));
    await seedTemplates(adminClient());
    expect(must(await adminClient().from("templates").select("id"))).toHaveLength(before.length);
    must(await adminClient().from("templates").insert(row(`server-made-${Date.now()}`)).select("id"));
  });

  it("refuses a designer template, a bad slug and a snapshot that is not an object", async () => {
    expect((await adminClient().from("templates").insert(row("designer-made", { source: "designer" }))).error).not.toBeNull();
    expect((await adminClient().from("templates").insert(row("Bad Slug"))).error).not.toBeNull();
    expect((await adminClient().from("templates").insert(row("not-an-object", { snapshot: [] }))).error).not.toBeNull();
  });

  it("names a person and a date for any review, and for nothing else", async () => {
    expect((await adminClient().from("templates").insert(row("reviewed-nobody", { review_state: "reviewed" }))).error).not.toBeNull();
    expect((await adminClient().from("templates").insert(row("named-not-reviewed", { reviewed_by: "A. Person" }))).error).not.toBeNull();
    must(
      await adminClient()
        .from("templates")
        .insert(row(`reviewed-${Date.now()}`, { review_state: "reviewed", reviewed_by: "A. Person", reviewed_at: "2026-10-25T00:00:00Z" }))
        .select("id"),
    );
  });
});
