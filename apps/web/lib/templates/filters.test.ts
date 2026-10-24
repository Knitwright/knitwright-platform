import { describe, expect, it } from "vitest";
import { applyFilters, filtersFromQuery, filterHref, listTemplates, TEMPLATES_PER_PAGE, type TemplateSummary } from "./filters";

const row = (n: number, over: Partial<TemplateSummary> = {}): TemplateSummary => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  slug: `t-${n}`,
  title: `Template ${n}`,
  sport: "football",
  articleId: "team-jersey",
  style: "hoops",
  styleTags: ["hoops"],
  colourFamily: "blue",
  reviewState: "not_reviewed",
  ...over,
});

describe("reading filters from an address", () => {
  it("keeps only listed values", () => {
    expect(filtersFromQuery({ sport: "football", article: "team-jersey", style: "hoops", colour: "blue" })).toEqual({
      sport: "football",
      article: "team-jersey",
      style: "hoops",
      colour: "blue",
    });
    expect(filtersFromQuery({ sport: "quidditch", style: "nonsense", colour: "pink!" })).toEqual({});
  });

  it("takes the first value when one is repeated and ignores an empty one", () => {
    expect(filtersFromQuery({ sport: ["cricket", "football"], colour: "" })).toEqual({ sport: "cricket" });
  });

  it("builds an address that round trips and drops page 1", () => {
    const filters = { sport: "football", colour: "red" } as const;
    expect(filterHref("/templates", filters, 1)).toBe("/templates?sport=football&colour=red");
    expect(filterHref("/templates", filters, 3)).toBe("/templates?sport=football&colour=red&page=3");
    expect(filterHref("/templates", {}, 1)).toBe("/templates");
  });
});

describe("filtering and paging a list", () => {
  const rows = [
    row(1),
    row(2, { sport: "cricket", articleId: "polo", style: "stripes", styleTags: ["stripes"], colourFamily: "red" }),
    row(3, { styleTags: ["hoops", "pinstripes"], colourFamily: "red" }),
  ];

  it("matches every filter given, and none given matches all", () => {
    expect(applyFilters(rows, {})).toHaveLength(3);
    expect(applyFilters(rows, { sport: "cricket" }).map((r) => r.slug)).toEqual(["t-2"]);
    expect(applyFilters(rows, { colour: "red", sport: "football" }).map((r) => r.slug)).toEqual(["t-3"]);
    expect(applyFilters(rows, { article: "polo", colour: "blue" })).toEqual([]);
  });

  it("matches a style on any style tag", () => {
    expect(applyFilters(rows, { style: "pinstripes" }).map((r) => r.slug)).toEqual(["t-3"]);
  });

  it("does not change the list it is given", () => {
    const copy = structuredClone(rows);
    applyFilters(rows, { sport: "cricket" });
    expect(rows).toEqual(copy);
  });

  it("pages the matches and says how many there are", () => {
    const many = Array.from({ length: TEMPLATES_PER_PAGE + 3 }, (_, i) => row(i + 1));
    const first = listTemplates(many, {}, 1);
    expect(first.rows).toHaveLength(TEMPLATES_PER_PAGE);
    expect(first.total).toBe(TEMPLATES_PER_PAGE + 3);
    expect(first.totalPages).toBe(2);
    expect(listTemplates(many, {}, 2).rows).toHaveLength(3);
    expect(listTemplates(many, {}, 9).rows).toEqual([]);
    expect(listTemplates([], {}, 1)).toEqual({ rows: [], total: 0, totalPages: 1, page: 1 });
  });
});
