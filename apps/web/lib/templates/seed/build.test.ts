import { describe, expect, it } from "vitest";
import { getType, validateSpec } from "@/lib/garment";
import { kitStylesFor } from "@/lib/kit-styles/presets";
import { REVIEW_LABELS, SPORTS, STYLE_IDS } from "../catalogue";
import { COLOUR_FAMILIES, colourFamilyOf } from "../colour-family";
import { buildSeedTemplates, SEED_COUNT, snapshotFor, type Plan } from "./build";

const seeds = buildSeedTemplates();

describe("the Knitwright starter templates", () => {
  it("makes twelve, with unique slugs and titles", () => {
    expect(seeds).toHaveLength(SEED_COUNT);
    expect(SEED_COUNT).toBe(12);
    expect(new Set(seeds.map((seed) => seed.slug)).size).toBe(12);
    expect(new Set(seeds.map((seed) => seed.title)).size).toBe(12);
  });

  it("is deterministic: two builds give identical JSON, with no date or random id", () => {
    expect(JSON.stringify(buildSeedTemplates())).toBe(JSON.stringify(seeds));
    expect(JSON.stringify(seeds)).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it.each(seeds.map((seed) => [seed.slug, seed] as const))("%s is a valid design on a makeable article", (_slug, seed) => {
    const checked = validateSpec(seed.snapshot);
    expect(checked.ok).toBe(true);
    expect(getType(seed.articleId)).toBeDefined();
    expect(seed.snapshot.typeId).toBe(seed.articleId);
    expect(kitStylesFor(seed.articleId).map((style) => style.id)).toContain(seed.style);
    expect(seed.snapshot.kitPattern?.style ?? "plain").toBe(seed.style);
    expect(SPORTS).toContain(seed.sport);
    expect(STYLE_IDS).toContain(seed.style);
    expect(seed.styleTags).toContain(seed.style);
    expect(COLOUR_FAMILIES).toContain(seed.colourFamily);
    expect(colourFamilyOf(seed.snapshot.colourways[0]!.colours.find((c) => c.panelId === "body-front")!.swatch ?? "")).toBe(seed.colourFamily);
  });

  it("marks every one as not reviewed by a factory", () => {
    for (const seed of seeds) {
      expect(seed.reviewState).toBe("not_reviewed");
      expect(REVIEW_LABELS[seed.reviewState]).toBe("Knitwright starter, not reviewed by a factory");
    }
  });

  it("covers several sports, articles and colour families", () => {
    expect(new Set(seeds.map((seed) => seed.sport)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(seeds.map((seed) => seed.articleId)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(seeds.map((seed) => seed.colourFamily)).size).toBeGreaterThanOrEqual(5);
  });
});

describe("a plan that cannot be built", () => {
  const plan: Plan = { slug: "x", title: "X", sport: "general", articleId: "team-jersey", wearer: "men", style: "hoops", colours: { main: "#1b2a49", second: "#ffffff", third: null } };

  it("builds a good plan", () => {
    expect(buildSeedTemplates([plan])).toHaveLength(1);
  });

  it("builds on a wearer that has no starter chart, with no sizes made up", () => {
    const youth = buildSeedTemplates([{ ...plan, wearer: "youth" }])[0]!;
    expect(youth.snapshot.wearer).toBe("youth");
  });

  it.each([
    ["an article the registry does not have", { articleId: "no-such-garment" }],
    ["a style the article does not come in", { articleId: "polo", style: "sash" as const }],
  ])("names the plan and says why for %s", (_what, over) => {
    expect(() => snapshotFor({ ...plan, ...over })).toThrow(/^x: /);
  });

  it("refuses a main colour that is not a swatch", () => {
    expect(() => buildSeedTemplates([{ ...plan, colours: { main: "navy", second: "#ffffff", third: null } }])).toThrow(/x: the main colour/);
  });
});
