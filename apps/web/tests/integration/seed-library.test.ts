import { describe, expect, it } from "vitest";
import { buildMarketingTemplates } from "@/lib/marketing/templates/build";
import { buildBundles } from "@/lib/templates/seed/bundles/build";
import { seedLibrary } from "@/lib/templates/seed/library";
import { everySeedTemplate } from "@/lib/templates/seed/seed";
import { adminClient, must } from "./support";

/**
 * `pnpm --filter web seed:templates` (plan v6 D5, decision 0136), against local Supabase: running the whole
 * library seed twice leaves the same rows as running it once. Only the seed's own rows are read, by slug, so a
 * row another test adds to the library cannot change the answer.
 */

const templateSlugs = (): string[] => [...everySeedTemplate().map((seed) => seed.slug), ...buildMarketingTemplates().map((t) => t.slug)];
const bundleSlugs = (): string[] => buildBundles().map((bundle) => bundle.slug);

/** What the seed's rows look like: every one of its rows, in a fixed order, without the clock columns. */
const library = async () => {
  const admin = adminClient();
  const templates = must(await admin.from("templates").select("id, slug, kind, title, snapshot").in("slug", templateSlugs()).order("slug"));
  const bundles = must(await admin.from("template_kit_bundles").select("id, slug, title").in("slug", bundleSlugs()).order("slug"));
  const members = must(
    await admin
      .from("template_kit_bundle_members")
      .select("bundle_slug, template_slug, role, slot, position")
      .in("bundle_slug", bundleSlugs())
      .order("bundle_slug")
      .order("position"),
  );
  const techpacks = must(await admin.from("template_techpacks").select("id, slug, base_article_code, sections").order("slug"));
  return { templates, bundles, members, techpacks };
};

describe("the whole template library seed", () => {
  it("writes every template, bundle, tech pack and marketing template, and the same rows a second time", async () => {
    const first = await seedLibrary(adminClient());
    const once = await library();

    expect(first.bundles).toBe(buildBundles().length);
    expect(first.techpacks).toBe(8);
    expect(once.templates).toHaveLength(templateSlugs().length);
    expect(once.bundles).toHaveLength(buildBundles().length);
    expect(once.members).toHaveLength(buildBundles().reduce((total, bundle) => total + bundle.members.length, 0));
    expect(once.techpacks).toHaveLength(8);

    const second = await seedLibrary(adminClient());
    expect(second.bundles).toBe(first.bundles);
    expect(second.techpacks).toBe(first.techpacks);
    // The same rows, with the same ids: a second run updates in place and adds nothing.
    expect(await library()).toEqual(once);
  });
});
