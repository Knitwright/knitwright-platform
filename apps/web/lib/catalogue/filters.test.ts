import { describe, expect, it } from "vitest";
import { catalogueFiltersSchema, filterArticles, type CatalogueFilters } from "./filters";
import { catalogue } from "./fixtures/source";
import type { BaseArticleSummary } from "./types";

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

const codes = (filters: CatalogueFilters): string[] => filterArticles(summaries, filters).map((article) => article.code);

describe("catalogue filters", () => {
  it("show everything when none is set", () => {
    expect(codes({})).toHaveLength(8);
  });

  it("filter by sport", () => {
    expect(codes({ sport: "football" })).toEqual(["JSY-SS-01", "SHO-TR-01"]);
    expect(codes({ sport: "cricket" })).toEqual(["CRK-SS-01"]);
    expect(codes({ sport: "rugby" })).toEqual([]);
  });

  it("filter by article type", () => {
    expect(codes({ articleType: "JSY" })).toEqual(["JSY-SS-01", "JSY-LS-01"]);
  });

  it("filter by class", () => {
    expect(codes({ productionClass: "B" })).toEqual(["TEE-TR-01", "HOD-ST-01"]);
  });

  it("filter by fabric", () => {
    expect(codes({ fabric: "F-POLY-INT" })).toEqual(["JSY-SS-01", "SHO-TR-01", "JSY-LS-01"]);
    expect(codes({ fabric: "F-POLY-RIB" })).toEqual(["JSY-SS-01"]);
  });

  it("filter by fit, matching only articles whose fit is known", () => {
    expect(codes({ fit: "regular" })).toEqual(["JSY-SS-01"]);
  });

  it("filter by gender, and no seeded article claims one", () => {
    expect(codes({ gender: "women" })).toEqual([]);
    const womens = { ...summaries[0]!, code: "JSY-SW-01", genders: ["women"] };
    expect(filterArticles([...summaries, womens], { gender: "women" }).map((a) => a.code)).toEqual(["JSY-SW-01"]);
  });

  it("filter by status and combine with the others", () => {
    expect(codes({ status: "live" })).toEqual([]);
    expect(codes({ status: "draft", sport: "training", productionClass: "A" })).toEqual(["JSY-SS-01", "SHO-TR-01"]);
  });

  it("refuse a filter the catalogue does not know, and a malformed value", () => {
    expect(catalogueFiltersSchema.safeParse({ colour: "red" }).success).toBe(false);
    expect(catalogueFiltersSchema.safeParse({ fabric: "polyester" }).success).toBe(false);
    expect(catalogueFiltersSchema.safeParse({ productionClass: "C" }).success).toBe(false);
    expect(catalogueFiltersSchema.safeParse({ articleType: "JSY", fabric: "F-POLY-INT" }).success).toBe(true);
  });
});
