import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COLOUR_FAMILIES } from "../colour-family";
import { STYLE_IDS } from "../catalogue";
import {
  ERA_TAGS,
  MOOD_TAGS,
  SPORT_TAGS,
  SPORT_TAG_LABELS,
  TAG_CHOICES,
  TAG_GROUPS,
  TAG_GROUP_LABELS,
  matchesSearch,
  matchesTags,
  searchTextOf,
  type TemplateTags,
} from "./tags";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");
const migration = (): string => readFileSync(join(REPO_ROOT, "supabase", "migrations", "20261201050000_template_kinds.sql"), "utf8");
const spec = (): string => readFileSync(join(REPO_ROOT, "docs", "spec", "07-template-library.md"), "utf8");

/** The values of the first `<column> <@ array[...]` check of the migration. */
function allowed(column: string): string[] {
  const found = new RegExp(`${column} <@ array\\[([^\\]]*)\\]`, "u").exec(migration());
  expect(found, `no vocabulary for ${column}`).not.toBeNull();
  return [...found![1]!.matchAll(/'([a-z0-9-]+)'/gu)].map((match) => match[1]!);
}

const tags = (over: Partial<TemplateTags> = {}): TemplateTags => ({
  sport: ["football"],
  style: ["hoops"],
  era: ["classic"],
  mood: ["bold"],
  colour: "blue",
  ...over,
});

describe("the launch tag set", () => {
  it("is the five groups 07 names", () => {
    expect(TAG_GROUPS).toEqual(["sport", "style", "era", "mood", "colour"]);
    for (const group of TAG_GROUPS) {
      expect(TAG_GROUP_LABELS[group].length).toBeGreaterThan(2);
      expect(TAG_CHOICES[group].length).toBeGreaterThan(2);
      for (const choice of TAG_CHOICES[group]) expect(choice.label.length).toBeGreaterThan(0);
    }
  });

  it("holds the same sport, era and mood words as the migration", () => {
    expect(allowed("sport_tags")).toEqual([...SPORT_TAGS]);
    expect(allowed("era_tags")).toEqual([...ERA_TAGS]);
    expect(allowed("mood_tags")).toEqual([...MOOD_TAGS]);
  });

  it("covers every sport group of 07's design-template table, esports and combat included", () => {
    const text = spec().toLowerCase();
    for (const tag of SPORT_TAGS) expect(text, tag).toContain(SPORT_TAG_LABELS[tag].split(" and ")[0]!.toLowerCase());
    expect(SPORT_TAGS).toContain("esports");
    expect(SPORT_TAGS).toContain("combat");
  });

  it("takes style and colour family from the vocabularies that already exist", () => {
    expect(TAG_CHOICES.style.map((choice) => choice.id)).toEqual([...STYLE_IDS]);
    expect(TAG_CHOICES.colour.map((choice) => choice.id)).toEqual([...COLOUR_FAMILIES]);
  });
});

describe("filtering on the tags", () => {
  it("shows everything when nothing is asked for", () => {
    expect(matchesTags(tags(), {})).toBe(true);
    expect(matchesTags(tags(), { sport: "" })).toBe(true);
  });

  it("narrows on each group on its own", () => {
    expect(matchesTags(tags(), { sport: "football" })).toBe(true);
    expect(matchesTags(tags(), { sport: "cricket" })).toBe(false);
    expect(matchesTags(tags(), { style: "hoops" })).toBe(true);
    expect(matchesTags(tags(), { style: "sash" })).toBe(false);
    expect(matchesTags(tags(), { era: "classic" })).toBe(true);
    expect(matchesTags(tags(), { era: "modern" })).toBe(false);
    expect(matchesTags(tags(), { mood: "bold" })).toBe(true);
    expect(matchesTags(tags(), { mood: "clean" })).toBe(false);
    expect(matchesTags(tags(), { colour: "blue" })).toBe(true);
    expect(matchesTags(tags(), { colour: "red" })).toBe(false);
  });

  it("needs every group the filter names", () => {
    expect(matchesTags(tags(), { sport: "football", colour: "blue" })).toBe(true);
    expect(matchesTags(tags(), { sport: "football", colour: "red" })).toBe(false);
  });

  it("shows nothing for a value no vocabulary holds", () => {
    expect(matchesTags(tags(), { sport: "quidditch" })).toBe(false);
  });

  it("matches a template that carries more than one tag in a group", () => {
    expect(matchesTags(tags({ sport: ["training", "esports"] }), { sport: "esports" })).toBe(true);
  });
});

describe("searching the tags", () => {
  it("looks through the title and every tag's words", () => {
    expect(searchTextOf("Navy and gold hoops", tags())).toContain("football");
    expect(searchTextOf("Navy and gold hoops", tags())).toContain("hoops");
  });

  it("matches on every word of the query, in any order and either case", () => {
    expect(matchesSearch("Navy and gold hoops", tags(), "HOOPS navy")).toBe(true);
    expect(matchesSearch("Navy and gold hoops", tags(), "football")).toBe(true);
    expect(matchesSearch("Navy and gold hoops", tags(), "cricket")).toBe(false);
  });

  it("matches everything for an empty query", () => {
    expect(matchesSearch("Anything", tags(), "   ")).toBe(true);
  });
});
