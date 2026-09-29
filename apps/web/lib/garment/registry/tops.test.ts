import { describe, expect, it } from "vitest";
import { getType, listFamilies, listTypes } from "./index";
import { TOPS } from "./tops";

const ids = (items: readonly { readonly id: string }[]): string[] => items.map((item) => item.id);
const type = (id: string) => {
  const found = getType(id);
  if (!found) throw new Error(`No type ${id}`);
  return found;
};
const offered = (typeId: string, optionId: string): string[] =>
  ids(type(typeId).options.find((option) => option.id === optionId)?.choices ?? []);

describe("tops registry", () => {
  it("has the five tops types and no types in the other families yet", () => {
    expect(ids(listTypes("tops"))).toEqual([
      "crew-tee",
      "v-neck-tee",
      "long-sleeve-tee",
      "polo",
      "team-jersey",
    ]);
    expect(ids(listFamilies())).toEqual(["tops", "bottoms", "outerwear", "close-fitting"]);
    for (const family of ["bottoms", "outerwear", "close-fitting"] as const) {
      expect(listTypes(family)).toEqual([]);
    }
  });

  it("applies men, women and youth charts to every tops type", () => {
    for (const entry of listTypes("tops")) {
      expect([...entry.wearers]).toEqual(["men", "women", "youth"]);
    }
  });

  it("defines all fourteen points of measure", () => {
    expect(ids(TOPS.pointsOfMeasure)).toEqual([
      "chest-width",
      "body-length",
      "shoulder-width",
      "sleeve-length",
      "armhole",
      "upper-arm",
      "sleeve-opening",
      "hem-width",
      "neck-width",
      "front-neck-drop",
      "back-neck-drop",
      "collar-height",
      "placket-length",
      "placket-width",
    ]);
  });

  it("gives every point of measure a full how to measure sentence", () => {
    for (const point of TOPS.pointsOfMeasure) {
      expect(point.howToMeasure.endsWith(".")).toBe(true);
      expect(point.howToMeasure.length).toBeGreaterThan(50);
      expect(point.howToMeasure).toMatch(/flat/i);
    }
  });

  it("holds no numbers in any text, so no size or tolerance can hide in the registry", () => {
    expect(JSON.stringify(TOPS).match(/\d/g)).toBeNull();
  });

  it("offers a V neck tee only V necklines and no collar", () => {
    expect(offered("v-neck-tee", "neckline")).toEqual(["v-neck"]);
    expect(offered("v-neck-tee", "collar")).toEqual(["none"]);
  });

  it("offers a long sleeve tee only long sleeves", () => {
    expect(offered("long-sleeve-tee", "sleeve-length")).toEqual(["long"]);
    expect(offered("crew-tee", "sleeve-length")).toEqual(["short"]);
  });

  it("offers raglan sleeves on the team jersey only", () => {
    expect(offered("team-jersey", "sleeve-type")).toEqual(["set-in", "raglan"]);
    for (const other of ["crew-tee", "v-neck-tee", "long-sleeve-tee", "polo"]) {
      expect(offered(other, "sleeve-type")).toEqual(["set-in"]);
    }
  });

  it("starts a polo with a polo collar and buttons", () => {
    const polo = type("polo");
    const defaultOf = (id: string) => polo.options.find((option) => option.id === id)?.defaultChoice;
    expect(defaultOf("collar")).toBe("polo-collar");
    expect(defaultOf("placket")).toBe("buttons");
  });

  it("gives plain tees no placket option, so the placket points never apply to them", () => {
    expect(type("crew-tee").options.some((option) => option.id === "placket")).toBe(false);
  });

  it("lets only the panels that can carry artwork have anchors", () => {
    const withAnchors = TOPS.panels.filter((panel) => panel.anchors.length > 0);
    expect(ids(withAnchors)).toEqual(["body-front", "body-back", "sleeve-left", "sleeve-right"]);
    const front = TOPS.panels.find((panel) => panel.id === "body-front");
    expect(ids(front?.anchors ?? [])).toContain("centre-chest");
  });
});
