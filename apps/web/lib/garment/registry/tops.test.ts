import { describe, expect, it } from "vitest";
import { getType, listFamilies, listTypes } from "./index";
import { POINT_GROUP_LABELS } from "../definitions";
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
  it("has the five tops types", () => {
    expect(ids(listTypes("tops"))).toEqual([
      "crew-tee",
      "v-neck-tee",
      "long-sleeve-tee",
      "polo",
      "team-jersey",
    ]);
    expect(ids(listFamilies())).toEqual(["tops", "bottoms", "outerwear", "close-fitting", "football", "cricket", "winter-code"]);
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

  it("gives the polo only buttons or a zip, so the polo collar rule can never be broken by a choice", () => {
    expect(offered("polo", "placket")).toEqual(["buttons", "zip"]);
  });

  it("starts each narrowed type on a choice it offers", () => {
    const defaultOf = (typeId: string, optionId: string) =>
      type(typeId).options.find((option) => option.id === optionId)?.defaultChoice;
    expect(defaultOf("v-neck-tee", "neckline")).toBe("v-neck");
    expect(defaultOf("long-sleeve-tee", "sleeve-length")).toBe("long");
  });

  it("puts every tops point of measure in one of four groups, and every group has a label", () => {
    const groupOf = (id: string) => TOPS.pointsOfMeasure.find((point) => point.id === id)?.group;
    expect(groupOf("chest-width")).toBe("body");
    expect(groupOf("armhole")).toBe("sleeve");
    expect(groupOf("front-neck-drop")).toBe("neck");
    expect(groupOf("placket-width")).toBe("placket");
    expect(new Set(TOPS.pointsOfMeasure.map((point) => point.group))).toEqual(new Set(["body", "neck", "placket", "sleeve"]));
    for (const label of Object.values(POINT_GROUP_LABELS)) expect(label.length).toBeGreaterThan(0);
  });

  it("keeps labels short and explains the harder ones in a help sentence", () => {
    for (const option of TOPS.options) expect(option.label.length).toBeLessThanOrEqual(30);
    const placket = TOPS.options.find((option) => option.id === "placket");
    expect(placket?.label).toBe("Placket");
    expect(placket?.help).toMatch(/fasten/);
    const raglan = TOPS.options.find((o) => o.id === "sleeve-type")?.choices.find((c) => c.id === "raglan");
    expect(raglan?.help).toMatch(/neck/);
  });

  it("gives every rule reason a second sentence that says the way out", () => {
    for (const rule of TOPS.rules) expect(rule.reason).toMatch(/\.\s+Choose [^.]+\.$/);
  });

  it("returns a copy of the type list, so callers cannot change the registry", () => {
    const list = listTypes("tops") as unknown[];
    list.length = 0;
    expect(listTypes("tops")).toHaveLength(5);
    expect(listTypes()).not.toBe(listTypes());
  });
});
