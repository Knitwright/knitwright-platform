import { describe, expect, it } from "vitest";
import { catalogue } from "@/lib/catalogue/fixtures/source";
import { appTier } from "@/lib/factory/fixtures/rows";
import { articleCard, formHint, groupLabel, sortArticles, sortFromQuery, tabFromQuery } from "./catalogue-view";

/** Decision 0074: the catalogue's tabs, sort and grid cards (spec F-S4). */

const all = catalogue();
const jersey = all[0]!;
const hoodie = all.find((article) => article.code === "HOD-ST-01")!;
const LADDER = [appTier(10, 19, 2900), appTier(50, null, 2200)];

describe("the tabs and the sort", () => {
  it("reads the tab from the address and shows base products by default", () => {
    expect(tabFromQuery("templates")).toBe("templates");
    expect(tabFromQuery(["templates"])).toBe("templates");
    expect(tabFromQuery("nonsense")).toBe("bases");
    expect(tabFromQuery(undefined)).toBe("bases");
  });

  it("reads the sort from the address and sorts by name by default", () => {
    expect(sortFromQuery("code")).toBe("code");
    expect(sortFromQuery("most-used")).toBe("name");
  });

  it("sorts by name both ways and by code", () => {
    const names = sortArticles(all, "name").map((article) => article.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en")));
    expect(sortArticles(all, "name-desc").map((a) => a.name)).toEqual([...names].reverse());
    expect(sortArticles(all, "code").map((a) => a.code)[0]).toBe("CMP-LS-01");
  });
});

describe("what the edit-form icon says", () => {
  it("names the worked article's own option groups and counts its ranges", () => {
    expect(formHint(jersey)).toBe("Collar, Sleeve finish and Pattern fill can be changed; 3 measurements move within the range on file.");
  });

  it("is null for an article with no options and no ranges on file", () => {
    expect(formHint(hoodie)).toBeNull();
  });

  it("reads a group key as words", () => {
    expect(groupLabel("sleeve_finish")).toBe("Sleeve finish");
    expect(groupLabel("collar")).toBe("Collar");
  });
});

describe("a grid card", () => {
  it("shows the code, the class, the status and the price line of the worked article", () => {
    const card = articleCard(jersey, { ladder: LADDER, moq: 1 }, "GBP");
    expect(card.code).toBe("JSY-SS-01");
    expect(card.href).toBe("/catalogue/JSY-SS-01");
    expect(card.tags).toEqual([
      { label: "Class A", tone: "class" },
      { label: "Draft, not reviewed by a factory", tone: "status" },
    ]);
    expect(card.price.line).toBe("From £22.00 · from 1 pc");
    expect(card.editableForm).toBe(true);
    expect(card.dataLabel).toBe("Knitwright draft v0.1, not reviewed by a factory");
  });

  it("marks an article with no options as having no form to edit, and no price where none is set", () => {
    const card = articleCard(hoodie, { ladder: [], moq: null }, "GBP");
    expect(card.editableForm).toBe(false);
    expect(card.formHint).toBeNull();
    expect(card.price.priced).toBe(false);
    expect(card.tags[0]).toEqual({ label: "Class B", tone: "class" });
  });
});
