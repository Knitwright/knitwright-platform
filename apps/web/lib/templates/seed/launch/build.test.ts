import { describe, expect, it } from "vitest";
import { baseArticleForType, typesForBaseArticle } from "@/lib/catalogue";
import { MAPPED_ARTICLE_CODES } from "@/lib/catalogue/registry-map";
import { LAUNCH_COUNTS } from "../../kinds";
import { SPORT_TAGS, matchesSearch, matchesTags, type SportTag } from "../../kinds/tags";
import { gapForType } from "../../kinds/gaps";
import { allSeedTemplates } from "../all";
import { tagsOf } from "../tagging";
import { buildBlockSeeds, blockSnapshot, type BlockPlan } from "./blocking";
import { paletteColour } from "./colours";
import { LAUNCH_BLOCK_PLANS, LAUNCH_KIT_STYLE_PLANS } from "./plans";

/**
 * The library against the launch counts of `docs/spec/07-template-library.md` (plan v5 L8, decision 0098).
 * The validation acceptance test is in `validation.test.ts`.
 */

const seeds = allSeedTemplates();
const tagged = seeds.map((seed) => ({ seed, tags: tagsOf(seed) }));
const withSportTag = (tag: SportTag) => tagged.filter((entry) => entry.tags.sport.includes(tag));

describe("the design templates at launch", () => {
  it("are the 60 that 07 asks for, with no slug or title twice", () => {
    expect(seeds).toHaveLength(LAUNCH_COUNTS.design);
    expect(new Set(seeds.map((seed) => seed.slug)).size).toBe(seeds.length);
    expect(new Set(seeds.map((seed) => seed.title)).size).toBe(seeds.length);
    expect(LAUNCH_KIT_STYLE_PLANS.length + LAUNCH_BLOCK_PLANS.length).toBe(27);
  });

  it("are built the same way every time, with no date and no random id", () => {
    expect(JSON.stringify(allSeedTemplates())).toBe(JSON.stringify(seeds));
  });

  it("is each a Knitwright starter that no factory has reviewed", () => {
    for (const seed of seeds) expect(seed.reviewState, seed.slug).toBe("not_reviewed");
  });

  it("covers every sport group of 07, esports and combat included", () => {
    for (const tag of SPORT_TAGS) expect(withSportTag(tag).length, tag).toBeGreaterThan(0);
    expect(withSportTag("esports")).toHaveLength(3);
    expect(withSportTag("combat")).toHaveLength(2);
  });

  it("sits on seven of the eight base articles, and on no garment the catalogue cannot name", () => {
    const codes = new Set(seeds.flatMap((seed) => baseArticleForType(seed.articleId) ?? []));
    // FSH-MM-01, the fight shorts, has no garment type at all (decision 0066), so it can carry no design.
    expect([...codes].sort()).toEqual(MAPPED_ARTICLE_CODES.filter((code) => typesForBaseArticle(code).length > 0).sort());
    expect(codes.has("FSH-MM-01")).toBe(false);
    expect(typesForBaseArticle("FSH-MM-01")).toEqual([]);
  });

  it("puts at least one starter on every garment type each base article stands behind that is used", () => {
    const types = new Set(seeds.map((seed) => seed.articleId));
    for (const type of ["team-jersey", "football-shirt", "goalkeeper-shirt", "long-sleeve-tee", "cricket-shirt", "crew-tee", "pullover-hoodie", "zip-hoodie", "compression-top", "shorts", "football-shorts"]) {
      expect(types, type).toContain(type);
    }
  });
});

describe("the launch tags", () => {
  it("gives every starter a style, a colour family, an era and a mood", () => {
    for (const { seed, tags } of tagged) {
      expect(tags.style.length, seed.slug).toBeGreaterThan(0);
      expect(tags.colour, seed.slug).toBe(seed.colourFamily);
      expect(tags.era.length, seed.slug).toBe(1);
      expect(tags.mood.length, seed.slug).toBe(1);
    }
  });

  it("files an esports or combat starter under the general sport and names its real group", () => {
    for (const entry of [...withSportTag("esports"), ...withSportTag("combat")]) expect(entry.seed.sport).toBe("general");
  });

  it("leaves a club-and-team-wear starter in none of the six groups rather than guessing one", () => {
    const general = tagged.filter((entry) => entry.seed.sport === "general" && entry.tags.sport.length === 0);
    expect(general.length).toBeGreaterThan(0);
  });

  it("narrows the library on each tag group, against the tags the starters carry", () => {
    expect(tagged.filter((entry) => matchesTags(entry.tags, { sport: "cricket" })).length).toBeGreaterThan(0);
    expect(tagged.filter((entry) => matchesTags(entry.tags, { mood: "playful" })).length).toBeGreaterThan(0);
    expect(tagged.filter((entry) => matchesTags(entry.tags, { era: "retro-90s" })).length).toBeGreaterThan(0);
    expect(tagged.filter((entry) => matchesTags(entry.tags, { sport: "esports", colour: "black" })).length).toBeGreaterThan(0);
    expect(tagged.filter((entry) => matchesTags(entry.tags, { sport: "cricket", colour: "purple" }))).toEqual([]);
  });

  it("finds a starter by a word of its title or of one of its tags", () => {
    const found = tagged.filter((entry) => matchesSearch(entry.seed.title, entry.tags, "rash guard"));
    expect(found.map((entry) => entry.seed.slug)).toEqual(["black-maroon-rash-guard", "navy-gold-rash-guard"]);
    expect(tagged.filter((entry) => matchesSearch(entry.seed.title, entry.tags, "esports")).length).toBe(3);
  });
});

describe("what a starter's card has to say about its article", () => {
  it("names the gap for every starter whose article has no measurement on file", () => {
    const hoodie = seeds.find((seed) => seed.articleId === "pullover-hoodie")!;
    const gap = gapForType(hoodie.articleId);

    expect(gap).not.toBeNull();
    expect(gap!.ruleId).toBe("R-PAT-501");
    expect(gap!.line).toBe("No measurement on file for this garment yet");
  });

  it("names none for the jersey, the one article with a factory-shaped brief", () => {
    expect(gapForType("team-jersey")).toBeNull();
  });

  it("has a gap for most of the library, because seven of the eight articles have no measurement", () => {
    const withGap = seeds.filter((seed) => gapForType(seed.articleId) !== null);
    expect(withGap.length).toBeGreaterThan(0);
    expect(withGap.length).toBeLessThan(seeds.length);
  });
});

describe("a plan that cannot be built", () => {
  const plan: BlockPlan = {
    slug: "x",
    title: "X",
    sport: "football",
    articleId: "pullover-hoodie",
    wearer: "men",
    body: "#1b2a49",
    trim: "#ffffff",
    options: {},
  };

  it("builds a good plan", () => {
    expect(blockSnapshot(plan).typeId).toBe("pullover-hoodie");
  });

  it.each([
    ["an article the registry does not have", { articleId: "no-such-garment" }],
    ["a choice the article does not offer", { options: { "front-opening": "full-zip" } }],
    ["an option the article does not have", { options: { "sock-height": "crew" } }],
  ])("names the plan and says why for %s", (_what, over) => {
    expect(() => blockSnapshot({ ...plan, ...over })).toThrow(/^x: /);
  });

  it("refuses a body colour that is not a swatch", () => {
    expect(() => buildBlockSeeds([{ ...plan, body: "navy" }])).toThrow(/x: the body colour/);
  });

  it("refuses a colour the editor's own palette does not offer", () => {
    expect(() => paletteColour("Puce")).toThrow(/is not a colour of the editor's palette/);
  });
});
