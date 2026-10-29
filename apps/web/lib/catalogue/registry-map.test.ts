import { describe, expect, it } from "vitest";
import { getType, listTypes } from "@/lib/garment";
import { catalogue } from "./fixtures/source";
import { baseArticleForType, MAPPED_ARTICLE_CODES, registryTypeForBaseArticle, typesForBaseArticle } from "./registry-map";

describe("base articles and garment registry types", () => {
  it("covers exactly the launch articles", () => {
    expect(MAPPED_ARTICLE_CODES).toEqual(catalogue().map((article) => article.code));
  });

  it("names only registry types that exist", () => {
    for (const code of MAPPED_ARTICLE_CODES) {
      for (const type of typesForBaseArticle(code)) expect(getType(type), `${code} -> ${type}`).toBeDefined();
    }
  });

  it("maps each registry type to at most one article, both ways", () => {
    for (const code of MAPPED_ARTICLE_CODES) {
      for (const type of typesForBaseArticle(code)) expect(baseArticleForType(type)).toBe(code);
    }
    const mapped = listTypes().filter((type) => baseArticleForType(type.id) !== undefined);
    expect(new Set(mapped.map((type) => type.id)).size).toBe(mapped.length);
  });

  it("makes a new design on an article as its first type, and has none for fight shorts yet", () => {
    expect(registryTypeForBaseArticle("JSY-SS-01")).toBe("football-shirt");
    expect(registryTypeForBaseArticle("SHO-TR-01")).toBe("football-shorts");
    expect(registryTypeForBaseArticle("FSH-MM-01")).toBeNull();
  });

  it("knows nothing of an unknown article or type", () => {
    expect(typesForBaseArticle("XXX-XX-00")).toEqual([]);
    expect(registryTypeForBaseArticle("XXX-XX-00")).toBeNull();
    expect(baseArticleForType("football-socks")).toBeUndefined();
  });

  it("stores the first type on each seeded article", () => {
    for (const article of catalogue()) expect(article.registryTypeId).toBe(registryTypeForBaseArticle(article.code));
  });
});
