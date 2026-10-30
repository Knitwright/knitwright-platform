import { describe, expect, it } from "vitest";
import { catalogue } from "@/lib/catalogue/fixtures/source";
import type { BaseArticleSummary } from "@/lib/catalogue/types";
import { emptyGroupsNote, filterGroups, filtersFromQuery, matchesSearch, searchFromQuery } from "./catalogue-filters";

/**
 * Decision 0074: the filter panel of spec F-S4, built from the eight launch articles X1 seeds
 * (decision 0066). Every option and every count comes from the rows, so the panel never offers a
 * filter that matches nothing and never shows a value no article claims.
 */

const summaries: readonly BaseArticleSummary[] = catalogue().map((article) => ({
  code: article.code,
  name: article.name,
  articleType: article.articleType,
  productionClass: article.productionClass,
  status: article.status,
  sportTags: article.sportTags,
  uses: article.uses,
  fit: article.fit,
  genders: article.genders,
  sizeRange: article.sizeRange,
  sampleSize: article.sampleSize,
  registryTypeId: article.registryTypeId,
  fabricCodes: article.fabrics.map((fabric) => fabric.code),
  dataLabel: article.dataLabel,
}));

const group = (key: string) => filterGroups(summaries).find((entry) => entry.key === key);

describe("the filter groups", () => {
  it("offers only the groups the rows have a value for, in the spec's order", () => {
    expect(filterGroups(summaries).map((entry) => entry.key)).toEqual(["sport", "articleType", "fit", "productionClass", "fabric"]);
  });

  it("says which groups no article has a value for, instead of showing an empty list", () => {
    expect(emptyGroupsNote(summaries)).toBe("Gender is not set on any base article yet, so it is not offered as a filter.");
    expect(emptyGroupsNote([])).toMatch(/^Sport, Article type, Fit, Gender, Production class, Fabric are not set/);
  });

  it("counts the articles behind every sport the catalogue holds", () => {
    expect(group("sport")?.options).toEqual([
      { value: "bjj", label: "BJJ", count: 1 },
      { value: "cricket", label: "Cricket", count: 1 },
      { value: "esports", label: "Esports", count: 1 },
      { value: "football", label: "Football", count: 2 },
      { value: "mma", label: "MMA", count: 1 },
      { value: "running", label: "Running", count: 1 },
      { value: "training", label: "Training", count: 3 },
    ]);
  });

  it("names the article type of a code in Knitwright's own words", () => {
    expect(group("articleType")?.options.map((option) => option.label)).toEqual([
      "Compression",
      "Cricket shirt",
      "Fight shorts",
      "Hoodie",
      "Jersey",
      "Shorts",
      "Tee",
    ]);
    expect(group("articleType")?.options.find((option) => option.value === "JSY")?.count).toBe(2);
  });

  it("counts the two production classes and every fabric code", () => {
    expect(group("productionClass")?.options).toEqual([
      { value: "A", label: "Class A", count: 6 },
      { value: "B", label: "Class B", count: 2 },
    ]);
    expect(group("fabric")?.options.map((option) => option.value)).toEqual([
      "F-POLY-4W",
      "F-POLY-EL",
      "F-POLY-INT",
      "F-POLY-PQ",
      "F-POLY-RIB",
      "F-STK-FLC",
      "F-STK-TEE",
    ]);
  });

  it("offers the one fit the build pack gives", () => {
    expect(group("fit")?.options).toEqual([{ value: "regular", label: "Regular", count: 1 }]);
  });
});

describe("the filters an address asks for", () => {
  it("keeps a value the catalogue really holds", () => {
    expect(filtersFromQuery({ sport: "football", productionClass: "B" }, summaries)).toEqual({ sport: "football", productionClass: "B" });
  });

  it("drops a value no article carries, so a stale address still shows the catalogue", () => {
    expect(filtersFromQuery({ sport: "curling", fit: "slim", gender: "men" }, summaries)).toEqual({});
  });

  it("reads the first of a repeated field and ignores a field that is not a filter", () => {
    expect(filtersFromQuery({ sport: ["cricket", "football"], tab: "bases" }, summaries)).toEqual({ sport: "cricket" });
  });
});

describe("the search field", () => {
  it("matches a name or a code, whatever the case, and matches everything when empty", () => {
    const jersey = summaries[0]!;
    expect(matchesSearch(jersey, "jsy")).toBe(true);
    expect(matchesSearch(jersey, "SUBLIMATED")).toBe(true);
    expect(matchesSearch(jersey, "  ")).toBe(true);
    expect(matchesSearch(jersey, "hoodie")).toBe(false);
  });

  it("reads the words from the address and caps their length", () => {
    expect(searchFromQuery({ q: "jersey" })).toBe("jersey");
    expect(searchFromQuery({})).toBe("");
    expect(searchFromQuery({ q: "x".repeat(200) })).toHaveLength(80);
  });
});
