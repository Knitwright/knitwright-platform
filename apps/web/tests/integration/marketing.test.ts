import { beforeAll, describe, expect, it } from "vitest";
import { SEEDED_EXPORT_TARGETS, SEEDED_WATERMARK_RULES } from "@/lib/marketing";
import { buildMarketingTemplates } from "@/lib/marketing/templates/build";
import { seedMarketingTemplates } from "@/lib/marketing/templates/seed";
import { listExportTargets, listMarketingTemplates, listWatermarkRules } from "@/lib/marketing/service";
import { loadLibrary } from "@/lib/templates/service";
import { adminClient, anonClient, must, person, type Person } from "./support";

/**
 * Migration 20261201060000: the marketing studio (plan v5 L4, decision 0094). The same rules as
 * `templates` itself: any signed-in user reads; nobody writes from a browser, a platform admin
 * included; the server writes through the service client.
 *
 * Two things here are the point:
 *
 *   * the 50 marketing rows are in `templates`, with every column that describes a design left
 *     empty, and the constraint says that is only allowed because they are not designs;
 *   * the design library's own read is narrowed to `kind = 'design'`, so those 50 rows do not break
 *     the page that lists the starters (decision 0091's note to L2 to L6).
 *
 * It reads and does not write, apart from the seed itself, which is found by slug and so adds
 * nothing on a second run.
 */

let alice: Person;
let admin: Person;

beforeAll(async () => {
  [alice, admin] = await Promise.all([person("mkt-alice"), person("mkt-admin")]);
  must(await adminClient().from("platform_admins").insert({ user_id: admin.userId }).select("user_id"));
  await seedMarketingTemplates(adminClient());
});

describe("the marketing templates in the library", () => {
  it("holds the 50 rows of 07 as marketing rows, readable by any signed-in user", async () => {
    const slugs = buildMarketingTemplates().map((one) => one.slug);
    const rows = must(await alice.client.from("templates").select("slug, kind, source, review_state").in("slug", slugs));

    expect(rows).toHaveLength(50);
    expect(rows.every((row) => row.kind === "marketing")).toBe(true);
    expect(rows.every((row) => row.source === "knitwright" && row.review_state === "not_reviewed")).toBe(true);
  });

  it("leaves every column that describes a design empty, because a layout is not on an article", async () => {
    const first = buildMarketingTemplates()[0]!;
    const row = must(await alice.client.from("templates").select("sport, article_id, wearer, style_tags, colour_family").eq("slug", first.slug).single());

    expect([row.sport, row.article_id, row.wearer, row.style_tags, row.colour_family]).toEqual([null, null, null, null, null]);
  });

  it("refuses a design row with those columns empty, which is what the constraint is for", async () => {
    const once = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const row = { slug: `mkt-check-${once}`, title: `Marketing check ${once}`, kind: "design", snapshot: {} };

    const refused = await adminClient().from("templates").insert(row);
    expect(refused.error).not.toBeNull();
  });

  it("reads a layout back with its slots, through the panel's own read", async () => {
    const views = await listMarketingTemplates(alice.client);
    const first = buildMarketingTemplates()[0]!;
    const view = views.find((one) => one.slug === first.slug)!;

    expect(views.length).toBeGreaterThanOrEqual(50);
    expect(view.layoutKey).toBe(first.layoutKey);
    expect(view.format).toBe(first.format);
    expect(view.slots).toHaveLength(first.slots.length);
    expect(view.ruleId).toBe("R-GAP-000");
  });

  it("keeps the design library to the design rows, so 50 marketing rows do not break it", async () => {
    // The design starters are L8's and may or may not have been seeded into this database, so this
    // says what must be true either way: not one of the 50 marketing rows is in the design library,
    // and every row that is in it has the article a design is drawn on.
    const library = await loadLibrary(alice.client);
    const slugs = new Set(buildMarketingTemplates().map((one) => one.slug));

    expect(library.some((one) => slugs.has(one.slug))).toBe(false);
    expect(library.every((one) => one.articleId !== "")).toBe(true);
  });

  it("is written by nobody from a browser, a platform admin included", async () => {
    const once = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const row = { slug: `mkt-browser-${once}`, title: `Browser ${once}`, kind: "marketing", snapshot: {} };

    expect((await alice.client.from("templates").insert(row)).error).not.toBeNull();
    expect((await admin.client.from("templates").insert(row)).error).not.toBeNull();
    expect((await anonClient().from("templates").select("slug")).error).not.toBeNull();
  });
});

describe("what the export panel offers", () => {
  it("holds the targets the migration seeds, the same as the code it is read with", async () => {
    const targets = await listExportTargets(alice.client);

    expect(targets.map((one) => one.key)).toEqual(SEEDED_EXPORT_TARGETS.map((one) => one.key));
    expect(targets).toEqual(SEEDED_EXPORT_TARGETS);
  });

  it("holds the spec's watermark sentence as two rows, the same as the code it is read with", async () => {
    const rules = await listWatermarkRules(alice.client);
    expect(rules).toEqual(SEEDED_WATERMARK_RULES);
  });

  it("is refused to a visitor, and written by nobody from a browser", async () => {
    expect((await anonClient().from("marketing_export_targets").select("key")).error).not.toBeNull();
    expect((await anonClient().from("marketing_watermark_rules").select("plan")).error).not.toBeNull();

    const target = { key: `bad-${Date.now()}`, label: "Bad", lead: "Bad", file_format: "png", colour_space: "rgb", dpi: 72, note: "no" };
    expect((await alice.client.from("marketing_export_targets").insert(target)).error).not.toBeNull();
    expect((await admin.client.from("marketing_export_targets").insert(target)).error).not.toBeNull();
    expect((await admin.client.from("marketing_watermark_rules").update({ max_dpi: 1200 }).eq("plan", "free")).error).not.toBeNull();
  });

  it("refuses a format, a colour space, a resolution or a plan the vocabulary does not hold", async () => {
    const once = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const base = { key: `check-${once}`, label: "Check", lead: "Check", file_format: "png", colour_space: "rgb", dpi: 72, note: "a check" };

    for (const over of [{ file_format: "tiff" }, { colour_space: "lab" }, { dpi: 0 }, { dpi: 2000 }, { rule_id: "nope" }]) {
      expect((await adminClient().from("marketing_export_targets").insert({ ...base, ...over })).error, JSON.stringify(over)).not.toBeNull();
    }
    expect((await adminClient().from("marketing_watermark_rules").insert({ plan: "enterprise", label: "No", watermarked: false, max_dpi: 300, note: "no" })).error).not.toBeNull();
  });
});
