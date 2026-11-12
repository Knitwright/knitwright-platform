import { describe, expect, it } from "vitest";
import type { ProductView } from "@/lib/brand-runs/service";
import type { TemplateSummary } from "@/lib/templates/filters";
import { CHANNEL_NONE, productRows, shortDate, stageChips, stageFromQuery } from "./mine";
import { ideaTiles, sportChips, sportFromQuery, TRENDS_LIMIT } from "./trends";

/** Plan v6 P4 (decision 0142): My products over brand_products, and Trending ideas over the template library. */

const product = (id: string, name: string, stage: ProductView["stage"], runs = 0): ProductView => ({
  id,
  projectId: `p-${id}`,
  name,
  stage,
  designVersion: 2,
  createdAt: "2026-11-04T10:00:00Z",
  runs: Array.from({ length: runs }, (_, index) => ({
    id: `r${index}`,
    kind: "run" as const,
    releaseId: "x",
    pieces: 10,
    sizes: {},
    flags: [],
    createdAt: "2026-12-04T10:00:00Z",
    order: null,
  })),
});

const PRODUCTS = [product("a", "Home shirt", "run", 2), product("b", "Away shirt", "idea"), product("c", "GK jersey", "sample", 1)];

describe("My products", () => {
  it("counts each stage for the chips and keeps the search in their addresses", () => {
    const chips = stageChips(PRODUCTS, "shirt");
    expect(chips.map((chip) => [chip.label, chip.count])).toEqual([["All", 3], ["Idea", 1], ["Sample", 1], ["Run", 1]]);
    expect(chips[0]!.href).toBe("/products/mine?q=shirt");
    expect(chips[3]!.href).toBe("/products/mine?stage=run&q=shirt");
    expect(stageChips([], "")[0]!.href).toBe("/products/mine");
  });

  it("reads the stage from the address, falling back to all", () => {
    expect(stageFromQuery("sample")).toBe("sample");
    expect(stageFromQuery(["run"])).toBe("run");
    expect(stageFromQuery("published")).toBe("all");
  });

  it("lists rows for the stage and the words, with the newest run's date and no invented channel", () => {
    const rows = productRows(PRODUCTS, "all", "SHIRT");
    expect(rows.map((row) => row.name)).toEqual(["Home shirt", "Away shirt"]);
    expect(rows[0]).toMatchObject({ detail: "Version 2 · 2 runs", updated: "4 Dec", channel: CHANNEL_NONE, editHref: "/studio/p-a", stageLabel: "Run" });
    expect(rows[1]).toMatchObject({ detail: "Version 2 · no runs yet", updated: "4 Nov" });
    expect(productRows(PRODUCTS, "sample", "")[0]!.detail).toBe("Version 2 · 1 run");
    expect(shortDate("2026-01-31T23:00:00Z")).toBe("31 Jan");
  });
});

const template = (id: string, sport: TemplateSummary["sport"]): TemplateSummary => ({
  id,
  slug: id,
  title: `Idea ${id}`,
  sport,
  articleId: "football-shirt",
  style: "plain",
  styleTags: ["plain"],
  colourFamily: "blue",
  reviewState: "reviewed",
});

describe("Trending ideas", () => {
  const TEMPLATES = [template("1", "football"), template("2", "cricket"), template("3", "football")];

  it("offers All and each sport some template is for, with counts", () => {
    expect(sportChips(TEMPLATES).map((chip) => [chip.label, chip.count, chip.href])).toEqual([
      ["All", 3, "/products/trends"],
      ["Football", 2, "/products/trends?sport=football"],
      ["Cricket", 1, "/products/trends?sport=cricket"],
    ]);
    expect(sportFromQuery("cricket")).toBe("cricket");
    expect(sportFromQuery(["nope"])).toBe("all");
  });

  it("lays the ideas of a sport into the masonry, capped", () => {
    const tiles = ideaTiles(TEMPLATES, "football");
    expect(tiles.map((tile) => tile.id)).toEqual(["1", "3"]);
    expect(tiles[0]).toMatchObject({ caption: "Football · Plain", height: "short", tone: "navy" });
    const many = Array.from({ length: 40 }, (_, index) => template(String(index), "running"));
    expect(ideaTiles(many, "all")).toHaveLength(TRENDS_LIMIT);
  });
});
