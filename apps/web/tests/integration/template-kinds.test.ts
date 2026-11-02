import { beforeAll, describe, expect, it } from "vitest";
import { allSeedTemplates } from "@/lib/templates/seed/all";
import { seedKitBundles } from "@/lib/templates/seed/bundles/seed";
import { buildBundles } from "@/lib/templates/seed/bundles/build";
import { seedTemplates } from "@/lib/templates/seed/seed";
import { seedTechpackTemplates } from "@/lib/templates/seed/techpacks/seed";
import { adminClient, anonClient, must, person, type Person } from "./support";

/**
 * Migration 20261201050000: the template kinds, the launch tag set, the kit bundles and the tech pack
 * templates (plan v5 L8, decision 0098). The same rules as `templates` itself: any signed-in user
 * reads them; nobody writes them from a browser, a platform admin included; the server writes through
 * the service client. (Written without a local database to run them on: see the pull request.)
 */

let alice: Person;
let admin: Person;

beforeAll(async () => {
  [alice, admin] = await Promise.all([person("tkind-alice"), person("tkind-admin")]);
  must(await adminClient().from("platform_admins").insert({ user_id: admin.userId }).select("user_id"));
  await seedTemplates(adminClient());
  await seedKitBundles(adminClient());
  await seedTechpackTemplates(adminClient());
});

describe("the kind column and the launch tags", () => {
  it("files every starter as a design, with the tags 07 asks for", async () => {
    // The starters by name, so a row another test in this suite adds cannot change the answer.
    const slugs = allSeedTemplates().map((seed) => seed.slug);
    const rows = must(await alice.client.from("templates").select("slug, kind, sport_tags, era_tags, mood_tags").in("slug", slugs));

    expect(rows).toHaveLength(60);
    expect(rows.every((row) => row.kind === "design")).toBe(true);
    expect(rows.every((row) => row.era_tags.length > 0 && row.mood_tags.length > 0)).toBe(true);
    expect(rows.some((row) => row.sport_tags.includes("esports"))).toBe(true);
    expect(rows.some((row) => row.sport_tags.includes("combat"))).toBe(true);
  });

  it("refuses a kind, a sport tag, an era or a mood the vocabulary does not hold", async () => {
    const columns = "sport, article_id, wearer, style_tags, colour_family, snapshot";
    const base = must(await adminClient().from("templates").select(columns).eq("slug", "navy-gold-hoops").single());
    // A new slug and title every time, and the general sport, so no browser spec's locator or count can
    // find these rows (plan v5 Lessons 11).
    const copy = (over: Record<string, unknown>) => {
      const once = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return { ...base, sport: "general", slug: `kind-check-${once}`, title: `Kind check ${once}`, ...over };
    };

    for (const over of [{ kind: "poster" }, { sport_tags: ["quidditch"] }, { era_tags: ["baroque"] }, { mood_tags: ["grumpy"] }]) {
      expect((await adminClient().from("templates").insert(copy(over))).error, JSON.stringify(over)).not.toBeNull();
    }
    // The spec's own two extra groups are allowed, and a row may carry no tag at all.
    must(await adminClient().from("templates").insert(copy({ sport_tags: ["esports", "combat"], era_tags: [], mood_tags: [] })).select("slug"));
  });
});

describe("the kit bundles in the database", () => {
  it("is readable by a signed-in user and refused to a visitor", async () => {
    const bundles = must(await alice.client.from("template_kit_bundles").select("slug, label, gaps"));

    expect(bundles).toHaveLength(buildBundles().length);
    expect(bundles.every((row) => row.label === "Knitwright starter, not reviewed by a factory")).toBe(true);
    expect(bundles.every((row) => (row.gaps as { rule_id: string }[]).every((gap) => gap.rule_id === "R-GAP-000"))).toBe(true);
    expect((await anonClient().from("template_kit_bundles").select("slug")).error).not.toBeNull();
    expect((await anonClient().from("template_kit_bundle_members").select("role")).error).not.toBeNull();
  });

  it("holds every member against a design that is really in the library", async () => {
    const members = must(await alice.client.from("template_kit_bundle_members").select("bundle_slug, template_slug, role, slot, position"));

    expect(members).toHaveLength(buildBundles().reduce((total, bundle) => total + bundle.members.length, 0));
    expect((await adminClient().from("template_kit_bundle_members").insert({ bundle_slug: "red-white-club-kit", template_slug: "no-such-design", role: "home", slot: "tee", position: 9 })).error).not.toBeNull();
    expect((await adminClient().from("template_kit_bundle_members").insert({ bundle_slug: "no-such-bundle", template_slug: "navy-gold-hoops", role: "home", slot: "tee", position: 9 })).error).not.toBeNull();
  });

  it("refuses a role, a slot or a place in the bundle that is already taken", async () => {
    const member = { bundle_slug: "red-white-club-kit", template_slug: "navy-gold-hoops", role: "home", slot: "shirt", position: 1 };

    expect((await adminClient().from("template_kit_bundle_members").insert(member)).error).not.toBeNull();
    expect((await adminClient().from("template_kit_bundle_members").insert({ ...member, position: 7, role: "warm-up", slot: "cape" })).error).not.toBeNull();
  });

  it("refuses a browser write from a member and from a platform admin", async () => {
    for (const who of [alice, admin]) {
      expect((await who.client.from("template_kit_bundles").insert({ slug: "browser-made", title: "Browser made", sport: "football", colour_family: "red", label: "x" })).error).not.toBeNull();
      expect((await who.client.from("template_kit_bundles").update({ title: "Changed" }).eq("slug", "red-white-club-kit")).error).not.toBeNull();
      expect((await who.client.from("template_kit_bundle_members").delete().eq("bundle_slug", "red-white-club-kit")).error).not.toBeNull();
    }
    const { data } = await adminClient().from("template_kit_bundles").select("title").eq("slug", "red-white-club-kit").single();
    expect(data?.title).toBe("Red and white club kit");
  });

  it("writes the bundles again without adding one", async () => {
    const before = must(await adminClient().from("template_kit_bundles").select("id"));
    await seedKitBundles(adminClient());
    expect(must(await adminClient().from("template_kit_bundles").select("id"))).toHaveLength(before.length);
  });
});

describe("the tech pack templates in the database", () => {
  it("has one per base article, each naming its gaps and their rules", async () => {
    const rows = must(await alice.client.from("template_techpacks").select("slug, base_article_code, sections, gaps, label"));

    expect(rows).toHaveLength(8);
    expect(new Set(rows.map((row) => row.base_article_code)).size).toBe(8);
    const hoodie = rows.find((row) => row.base_article_code === "HOD-ST-01")!;
    expect(hoodie.sections).not.toContain("measurements");
    expect((hoodie.gaps as { rule_id: string }[]).map((gap) => gap.rule_id)).toContain("R-FIT-501");
    expect(rows.every((row) => String(row.label).includes("not reviewed by a factory"))).toBe(true);
  });

  it("is refused to a visitor, and to a browser write from anyone", async () => {
    expect((await anonClient().from("template_techpacks").select("slug")).error).not.toBeNull();
    for (const who of [alice, admin]) {
      expect((await who.client.from("template_techpacks").insert({ slug: "browser-made", base_article_code: "JSY-SS-01", title: "Browser made", sections: ["cover"], label: "x" })).error).not.toBeNull();
      expect((await who.client.from("template_techpacks").delete().eq("slug", "techpack-jsy-ss-01")).error).not.toBeNull();
    }
  });

  it("refuses a template for an article the catalogue does not have, and a second one for the same article", async () => {
    const row = { slug: `techpack-made-up-${Date.now()}`, base_article_code: "ZZZ-ZZ-99", title: "Made up", sections: ["cover"], label: "Knitwright draft, not reviewed by a factory" };

    expect((await adminClient().from("template_techpacks").insert(row)).error).not.toBeNull();
    expect((await adminClient().from("template_techpacks").insert({ ...row, base_article_code: "JSY-SS-01" })).error).not.toBeNull();
  });

  it("writes the templates again without adding one", async () => {
    const before = must(await adminClient().from("template_techpacks").select("id"));
    await seedTechpackTemplates(adminClient());
    expect(must(await adminClient().from("template_techpacks").select("id"))).toHaveLength(before.length);
  });
});
