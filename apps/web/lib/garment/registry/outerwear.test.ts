import { describe, expect, it } from "vitest";
import { panelsFor, pointsOfMeasureFor } from "../applicability";
import { checkCombination } from "../combinations";
import { componentSlotsFor, seamsFor } from "../construction";
import { OUTERWEAR } from "./outerwear";
import { TOPS } from "./tops";
import { getType, listTypes } from "./index";

const ids = (items: readonly { readonly id: string }[]): string[] => items.map((item) => item.id);
const type = (id: string) => {
  const found = getType(id);
  if (!found) throw new Error(`No type ${id}`);
  return found;
};
const offered = (typeId: string, optionId: string): string[] =>
  ids(type(typeId).options.find((option) => option.id === optionId)?.choices ?? []);
const startChoices = (typeId: string): Record<string, string> =>
  Object.fromEntries(type(typeId).options.map((option) => [option.id, option.defaultChoice]));
const pointsOf = (typeId: string, choices: Record<string, string> = {}) =>
  ids(pointsOfMeasureFor({ typeId, options: { ...startChoices(typeId), ...choices } }));

describe("outerwear registry", () => {
  it("has a pullover hoodie, a zip hoodie and a track jacket, for men, women and youth", () => {
    expect(ids(listTypes("outerwear"))).toEqual(["pullover-hoodie", "zip-hoodie", "track-jacket"]);
    for (const entry of listTypes("outerwear")) expect([...entry.wearers]).toEqual(["men", "women", "youth"]);
  });

  it("adds the points of measure the plan lists for outerwear to the body points of a top", () => {
    expect(ids(OUTERWEAR.pointsOfMeasure)).toEqual([
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
      "hood-height",
      "hood-width",
      "zip-length",
      "pocket-opening",
      "pocket-width",
      "pocket-height",
      "cuff-height",
      "hem-band-height",
      "collar-height",
    ]);
  });

  it("measures the body the same way a top is measured", () => {
    const same = ["chest-width", "body-length", "sleeve-length", "armhole", "hem-width"];
    for (const id of same) {
      expect(OUTERWEAR.pointsOfMeasure.find((point) => point.id === id)).toEqual(TOPS.pointsOfMeasure.find((point) => point.id === id));
    }
  });

  it("measures a hood only on hoodies, and a zip only where there is one", () => {
    expect(pointsOf("pullover-hoodie")).toEqual(expect.arrayContaining(["hood-height", "hood-width"]));
    expect(pointsOf("pullover-hoodie")).not.toContain("zip-length");
    expect(pointsOf("zip-hoodie")).toContain("zip-length");
    expect(pointsOf("track-jacket")).not.toContain("hood-height");
    expect(pointsOf("track-jacket")).toContain("collar-height");
    expect(pointsOf("track-jacket", { collar: "none" })).not.toContain("collar-height");
  });

  it("measures pocket width and height on a kangaroo pocket only, and rib heights only with rib", () => {
    expect(pointsOf("pullover-hoodie")).toEqual(expect.arrayContaining(["pocket-opening", "pocket-width", "pocket-height"]));
    expect(pointsOf("zip-hoodie")).toContain("pocket-opening");
    expect(pointsOf("zip-hoodie")).not.toContain("pocket-width");
    expect(pointsOf("zip-hoodie", { pockets: "none" })).not.toContain("pocket-opening");
    expect(pointsOf("zip-hoodie", { cuffs: "hem", "hem-finish": "hem" })).not.toEqual(
      expect.arrayContaining(["cuff-height"]),
    );
    expect(pointsOf("zip-hoodie", { cuffs: "hem", "hem-finish": "hem" })).not.toContain("hem-band-height");
  });

  it("groups the new points under hood, zip, pockets and rib", () => {
    const groupOf = (id: string) => OUTERWEAR.pointsOfMeasure.find((point) => point.id === id)?.group;
    expect(groupOf("hood-width")).toBe("hood");
    expect(groupOf("zip-length")).toBe("zip");
    expect(groupOf("pocket-height")).toBe("pocket");
    expect(groupOf("cuff-height")).toBe("rib");
    expect(groupOf("collar-height")).toBe("neck");
  });

  it("offers a kangaroo pocket on the pullover only, and refuses it with a full zip", () => {
    expect(offered("pullover-hoodie", "pockets")).toContain("kangaroo");
    expect(offered("zip-hoodie", "pockets")).not.toContain("kangaroo");
    expect(offered("track-jacket", "pockets")).not.toContain("kangaroo");
    const cut = { ...startChoices("zip-hoodie"), pockets: "kangaroo" };
    expect(checkCombination("zip-hoodie", cut).map((entry) => entry.ruleId)).toEqual(["kangaroo-needs-closed-front"]);
  });

  it("draws a hood lining only on a lined hood", () => {
    expect(ids(panelsFor({ typeId: "pullover-hoodie", options: startChoices("pullover-hoodie") }))).toEqual([
      "body-front",
      "body-back",
      "sleeve-left",
      "sleeve-right",
      "hood",
      "hood-lining",
      "kangaroo-pocket",
      "cuffs",
      "hem-band",
    ]);
    const single = { ...startChoices("pullover-hoodie"), hood: "single-layer" };
    expect(ids(panelsFor({ typeId: "pullover-hoodie", options: single }))).not.toContain("hood-lining");
    expect(ids(seamsFor({ typeId: "pullover-hoodie", options: single }))).toContain("hood-edge");
  });

  it("finishes a track jacket without a collar with a neckband", () => {
    const bare = { ...startChoices("track-jacket"), collar: "none" };
    expect(ids(panelsFor({ typeId: "track-jacket", options: bare }))).toContain("neckband");
    expect(ids(panelsFor({ typeId: "track-jacket", options: startChoices("track-jacket") }))).toContain("collar");
  });

  it("asks for a zip and a zip guard with a full zip, and a hood drawcord only when chosen", () => {
    const zip = ids(componentSlotsFor({ typeId: "zip-hoodie", options: startChoices("zip-hoodie") }));
    expect(zip).toEqual(expect.arrayContaining(["front-zip", "zip-guard", "hood-drawcord", "drawcord-exits"]));
    const noCord = { ...startChoices("zip-hoodie"), "hood-drawcord": "none" };
    expect(ids(componentSlotsFor({ typeId: "zip-hoodie", options: noCord }))).not.toContain("hood-drawcord");
    const pullover = ids(componentSlotsFor({ typeId: "pullover-hoodie", options: startChoices("pullover-hoodie") }));
    expect(pullover).not.toContain("front-zip");
  });
});

describe("outerwear construction rules (step 21)", () => {
  it("closes the bags of side pockets with a seam, but not a kangaroo pocket", () => {
    for (const pockets of ["side-seam", "zip-side"]) {
      const seams = seamsFor({ typeId: "zip-hoodie", options: { ...startChoices("zip-hoodie"), pockets } });
      expect(ids(seams), pockets).toContain("pocket-bag-seam");
    }
    expect(ids(seamsFor({ typeId: "pullover-hoodie", options: startChoices("pullover-hoodie") }))).not.toContain("pocket-bag-seam");
  });

  it("proposes cord ends with a hood drawcord, marked as a proposal", () => {
    const ends = componentSlotsFor({ typeId: "pullover-hoodie", options: startChoices("pullover-hoodie") }).find((slot) => slot.id === "cord-ends");
    expect(ends?.proposal).toBe(true);
    const none = componentSlotsFor({ typeId: "pullover-hoodie", options: { ...startChoices("pullover-hoodie"), "hood-drawcord": "none" } });
    expect(ids(none)).not.toContain("cord-ends");
  });
});
