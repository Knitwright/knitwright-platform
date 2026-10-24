import { describe, expect, it } from "vitest";
import { getType, panelsFor, validateSpec } from "@/lib/garment";
import { buildFlat } from "@/lib/flat/build";
import { resolveMeasurements } from "@/lib/sizing";
import { tableSize } from "@/lib/projects/measurement-table";
import { REVIEW_LABELS, SPORTS, STYLE_IDS } from "../../catalogue";
import { COLOUR_FAMILIES, colourFamilyOf } from "../../colour-family";
import { specFromSnapshot } from "../../copy";
import { buildSeedTemplates } from "../build";
import { allSeedTemplates } from "../all";
import { applyFilters } from "../../filters";
import { articleChoices } from "../../library";
import { buildTeamwearSeeds, TEAMWEAR_SEED_ARTICLES, teamwearSnapshot, type TeamwearPlan } from "./build";

const seeds = buildTeamwearSeeds();

describe("the football and cricket starter templates", () => {
  it("makes at least three for each shirt, short, trouser and tee that has a flat", () => {
    expect(TEAMWEAR_SEED_ARTICLES).toEqual([
      "football-shirt",
      "football-shorts",
      "goalkeeper-shirt",
      "football-training-top",
      "cricket-shirt",
      "cricket-trousers",
      "cricket-training-tee",
    ]);
    for (const article of TEAMWEAR_SEED_ARTICLES) {
      expect(seeds.filter((seed) => seed.articleId === article).length).toBeGreaterThanOrEqual(3);
    }
  });

  it("makes none for socks, the cap or the empty winter code slot", () => {
    const ids = new Set(seeds.map((seed) => seed.articleId));
    for (const left of ["football-socks", "cricket-cap", "winter-code-top"]) expect(ids.has(left)).toBe(false);
  });

  it("files football articles under football and cricket articles under cricket", () => {
    for (const seed of seeds) expect(seed.sport).toBe(seed.articleId.startsWith("cricket") ? "cricket" : "football");
  });

  it("has unique slugs and titles, also among the twelve first starters", () => {
    const everything = allSeedTemplates();
    expect(new Set(everything.map((seed) => seed.slug)).size).toBe(everything.length);
    expect(new Set(everything.map((seed) => seed.title)).size).toBe(everything.length);
    expect(everything).toHaveLength(buildSeedTemplates().length + seeds.length);
  });

  it("is deterministic, with no date or random id", () => {
    expect(JSON.stringify(buildTeamwearSeeds())).toBe(JSON.stringify(seeds));
    expect(JSON.stringify(seeds)).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it.each(seeds.map((seed) => [seed.slug, seed] as const))("%s is a valid design on its article, and opens through the copy path", (_slug, seed) => {
    expect(validateSpec(seed.snapshot).ok).toBe(true);
    expect(getType(seed.articleId)).toBeDefined();
    expect(seed.snapshot.typeId).toBe(seed.articleId);
    expect(seed.snapshot.wearer).toBe(seed.wearer);
    expect(SPORTS).toContain(seed.sport);
    expect(seed.styleTags.every((tag) => STYLE_IDS.includes(tag))).toBe(true);
    expect(COLOUR_FAMILIES).toContain(seed.colourFamily);
    const copy = specFromSnapshot(JSON.parse(JSON.stringify(seed.snapshot)));
    expect(copy.ok).toBe(true);
    if (copy.ok) expect(copy.spec).toEqual(seed.snapshot);
  });

  it.each(seeds.map((seed) => [seed.slug, seed] as const))("%s draws a flat", (_slug, seed) => {
    const spec = seed.snapshot;
    const measurements = resolveMeasurements(spec, tableSize(spec));
    for (const view of ["front", "back"] as const) {
      expect(buildFlat({ spec, measurements, view, colourwayId: spec.colourways[0].id })).not.toBeNull();
    }
  });

  it.each(seeds.map((seed) => [seed.slug, seed] as const))("%s colours only panels the article has, and sets the colour family from the body", (_slug, seed) => {
    const present = new Set(panelsFor(seed.snapshot).map((panel) => panel.id));
    const colours = seed.snapshot.colourways[0]!.colours;
    expect(colours.length).toBeGreaterThan(0);
    for (const entry of colours) expect(present.has(entry.panelId)).toBe(true);
    const main = colours.find((entry) => entry.panelId === "body-front" || entry.panelId === "legs-front");
    expect(colourFamilyOf(main?.swatch ?? "")).toBe(seed.colourFamily);
  });

  it("carries no invented measurement: no measurement is set on any starter", () => {
    for (const seed of seeds) expect(seed.snapshot.measurements).toEqual([]);
  });

  it("uses the real options of the article: padded elbows only with a long sleeve, trousers full length", () => {
    const keeper = seeds.filter((seed) => seed.articleId === "goalkeeper-shirt");
    expect(keeper.some((seed) => seed.snapshot.options["elbow-pads"]?.choiceId === "padded-elbows")).toBe(true);
    for (const seed of seeds.filter((entry) => entry.articleId === "cricket-trousers")) {
      expect(seed.snapshot.options["leg-length"]?.choiceId).toBe("full");
    }
  });

  it("marks every one as not reviewed by a factory", () => {
    for (const seed of seeds) {
      expect(seed.reviewState).toBe("not_reviewed");
      expect(REVIEW_LABELS[seed.reviewState]).toBe("Knitwright starter, not reviewed by a factory");
    }
  });
});

describe("a plan that cannot be built", () => {
  const plan: TeamwearPlan = {
    slug: "x",
    title: "X",
    articleId: "football-shirt",
    wearer: "men",
    body: "#1b2a49",
    trim: "#ffffff",
    options: {},
  };

  it("builds a good plan", () => {
    expect(teamwearSnapshot(plan).typeId).toBe("football-shirt");
  });

  it.each([
    ["an article the registry does not have", { articleId: "no-such-garment" }],
    ["a choice the article does not offer", { options: { "sleeve-length": "sleeveless" } }],
    ["a rule that refuses the pair", { articleId: "goalkeeper-shirt", options: { "sleeve-length": "short", "elbow-pads": "padded-elbows" } }],
  ])("names the plan and says why for %s", (_what, over) => {
    expect(() => teamwearSnapshot({ ...plan, ...over })).toThrow(/^x: /);
  });

  it("refuses a body colour that is not a swatch", () => {
    expect(() => buildTeamwearSeeds([{ ...plan, body: "navy" }])).toThrow(/x: the body colour/);
  });
});

describe("the library filters with the football and cricket starters", () => {
  const summaries = allSeedTemplates().map((seed, n) => ({
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    slug: seed.slug,
    title: seed.title,
    sport: seed.sport,
    articleId: seed.articleId,
    style: seed.style,
    styleTags: seed.styleTags,
    colourFamily: seed.colourFamily,
    reviewState: seed.reviewState,
  }));

  it("narrows by sport and by article, and lists each new article as a garment choice", () => {
    expect(applyFilters(summaries, { sport: "cricket" }).every((row) => row.sport === "cricket")).toBe(true);
    expect(applyFilters(summaries, { sport: "football", article: "football-shirt" })).toHaveLength(3);
    expect(applyFilters(summaries, { article: "cricket-trousers" })).toHaveLength(3);
    const labels = articleChoices(summaries).map((choice) => choice.label);
    for (const article of TEAMWEAR_SEED_ARTICLES) expect(labels).toContain(getType(article)!.label);
  });
});
