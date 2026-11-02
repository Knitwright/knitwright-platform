import { describe, expect, it } from "vitest";
import { baseArticleForType } from "@/lib/catalogue";
import { LAUNCH_COUNTS } from "../../kinds";
import { SPORT_TAGS, matchesSearch, matchesTags } from "../../kinds/tags";
import { allSeedTemplates } from "../all";
import { everySeedTemplate, rowOf } from "../seed";
import { tagsOf } from "../tagging";
import { AUSTRALIA_SEED_COUNT, australiaSeedTemplates } from "./build";
import { AUSTRALIA_BLOCK_PLANS, AUSTRALIA_GAPS, AUSTRALIA_KIT_STYLE_PLANS } from "./plans";

/**
 * The Australian starters (plan v5 O3, decision 0104): Australian football, netball and cricket, beside
 * the 60 of `docs/spec/07-template-library.md` and not inside them.
 */

const seeds = australiaSeedTemplates();
const tagged = seeds.map((seed) => ({ seed, tags: tagsOf(seed) }));

describe("the Australian starters", () => {
  it("are the eight the plans name, with no slug or title twice", () => {
    expect(seeds).toHaveLength(AUSTRALIA_SEED_COUNT);
    expect(AUSTRALIA_SEED_COUNT).toBe(8);
    expect(AUSTRALIA_KIT_STYLE_PLANS.length + AUSTRALIA_BLOCK_PLANS.length).toBe(AUSTRALIA_SEED_COUNT);
    expect(new Set(seeds.map((seed) => seed.slug)).size).toBe(seeds.length);
    expect(new Set(seeds.map((seed) => seed.title)).size).toBe(seeds.length);
  });

  it("leave the 60 of 07 exactly as they were, and go in the library beside them", () => {
    expect(allSeedTemplates()).toHaveLength(LAUNCH_COUNTS.design);
    const slugs = new Set(allSeedTemplates().map((seed) => seed.slug));
    for (const seed of seeds) expect(slugs.has(seed.slug), seed.slug).toBe(false);
    expect(everySeedTemplate()).toHaveLength(LAUNCH_COUNTS.design + AUSTRALIA_SEED_COUNT);
  });

  it("are built the same way every time, with no date and no random id", () => {
    expect(JSON.stringify(australiaSeedTemplates())).toBe(JSON.stringify(seeds));
  });

  it("is each a Knitwright starter that no factory has reviewed", () => {
    for (const seed of seeds) expect(seed.reviewState, seed.slug).toBe("not_reviewed");
  });

  it("covers Australian football, netball and cricket, and says so in every title", () => {
    const titles = seeds.map((seed) => seed.title);
    expect(titles.filter((title) => title.startsWith("Australian football"))).toHaveLength(3);
    expect(titles.filter((title) => title.startsWith("Netball"))).toHaveLength(3);
    expect(titles.filter((title) => title.includes("cricket"))).toHaveLength(2);
  });

  it("sits only on garments the registry has, and on none it does not", () => {
    for (const seed of seeds) {
      expect(seed.snapshot.typeId, seed.slug).toBe(seed.articleId);
      expect(["team-jersey", "v-neck-tee", "crew-tee", "shorts", "cricket-shirt"], seed.slug).toContain(seed.articleId);
    }
    expect(baseArticleForType("cricket-shirt")).toBe("CRK-SS-01");
  });

  it("is a row the library can store, with every column the table asks for", () => {
    const row = rowOf(seeds[0]!);
    expect(row).toMatchObject({ kind: "design", source: "knitwright", review_state: "not_reviewed" });
    expect(row.article_id).toBe(seeds[0]!.articleId);
    expect(row.wearer).toBe(seeds[0]!.wearer);
    expect(row.style_tags.length).toBeGreaterThan(0);
  });
});

describe("the tags of the Australian starters", () => {
  it("tags the cricket shirts cricket, which is one of 07's six groups", () => {
    const cricket = tagged.filter((entry) => entry.tags.sport.includes("cricket"));
    expect(cricket).toHaveLength(2);
    for (const entry of cricket) expect(entry.seed.sport, entry.seed.slug).toBe("cricket");
  });

  it("gives the football and netball starters no sport tag, rather than one of the six that is not theirs", () => {
    const untagged = tagged.filter((entry) => entry.tags.sport.length === 0);
    expect(untagged).toHaveLength(6);
    for (const entry of untagged) {
      expect(entry.seed.sport, entry.seed.slug).toBe("general");
      for (const tag of SPORT_TAGS) expect(matchesTags(entry.tags, { sport: tag }), `${entry.seed.slug} ${tag}`).toBe(false);
    }
  });

  it("gives every one a style, a colour family, an era and a mood", () => {
    for (const { seed, tags } of tagged) {
      expect(tags.style.length, seed.slug).toBeGreaterThan(0);
      expect(tags.colour, seed.slug).toBe(seed.colourFamily);
      expect(tags.era.length, seed.slug).toBe(1);
      expect(tags.mood.length, seed.slug).toBe(1);
    }
  });

  it("is found by the sport in its title, which is how a club looks for it", () => {
    const found = (query: string) => tagged.filter((entry) => matchesSearch(entry.seed.title, entry.tags, query)).map((entry) => entry.seed.slug);
    expect(found("netball")).toEqual(["netball-purple-white-top", "netball-green-gold-top", "netball-purple-white-shorts"]);
    expect(found("australian football")).toHaveLength(3);
    expect(found("australian club cricket")).toHaveLength(2);
  });

  it("names what the library still has no garment for, each with a rule", () => {
    expect(AUSTRALIA_GAPS.length).toBe(3);
    for (const gap of AUSTRALIA_GAPS) {
      expect(gap.ruleId, gap.note).toMatch(/^R-[A-Z]+-\d{3}$/u);
      expect(gap.note.length, gap.note).toBeGreaterThan(40);
    }
    expect(AUSTRALIA_GAPS.map((gap) => gap.note).join(" ")).toContain("guernsey");
    expect(AUSTRALIA_GAPS.map((gap) => gap.note).join(" ")).toContain("netball dress");
  });
});
