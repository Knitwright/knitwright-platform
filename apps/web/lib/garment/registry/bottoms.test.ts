import { describe, expect, it } from "vitest";
import { panelsFor, pointsOfMeasureFor } from "../applicability";
import { checkCombination } from "../combinations";
import { componentSlotsFor, seamsFor } from "../construction";
import { BOTTOMS } from "./bottoms";
import { getType, listTypes } from "./index";

const ids = (items: readonly { readonly id: string }[]): string[] => items.map((item) => item.id);
const type = (id: string) => {
  const found = getType(id);
  if (!found) throw new Error(`No type ${id}`);
  return found;
};
const offered = (typeId: string, optionId: string): string[] =>
  ids(type(typeId).options.find((option) => option.id === optionId)?.choices ?? []);
const defaultOf = (typeId: string, optionId: string) =>
  type(typeId).options.find((option) => option.id === optionId)?.defaultChoice;
const startChoices = (typeId: string): Record<string, string> =>
  Object.fromEntries(type(typeId).options.map((option) => [option.id, option.defaultChoice]));

describe("bottoms registry", () => {
  it("has shorts, joggers, leggings and track pants", () => {
    expect(ids(listTypes("bottoms"))).toEqual(["shorts", "joggers", "leggings", "track-pants"]);
  });

  it("applies men, women and youth charts to every bottoms type", () => {
    for (const entry of listTypes("bottoms")) expect([...entry.wearers]).toEqual(["men", "women", "youth"]);
  });

  it("defines the points of measure the plan lists for bottoms", () => {
    expect(ids(BOTTOMS.pointsOfMeasure)).toEqual([
      "waist-relaxed",
      "waist-stretched",
      "waistband-height",
      "hip",
      "front-rise",
      "back-rise",
      "thigh",
      "knee",
      "leg-opening",
      "inseam",
      "outseam",
    ]);
  });

  it("groups bottoms points under waist, rise and leg", () => {
    const groupOf = (id: string) => BOTTOMS.pointsOfMeasure.find((point) => point.id === id)?.group;
    expect(groupOf("waist-stretched")).toBe("waist");
    expect(groupOf("hip")).toBe("waist");
    expect(groupOf("back-rise")).toBe("rise");
    expect(groupOf("inseam")).toBe("leg");
  });

  it("measures no knee on shorts, and a knee on every full or cropped leg", () => {
    expect(ids(pointsOfMeasureFor({ typeId: "shorts", options: startChoices("shorts") }))).not.toContain("knee");
    for (const id of ["joggers", "leggings", "track-pants"]) {
      expect(ids(pointsOfMeasureFor({ typeId: id, options: startChoices(id) }))).toContain("knee");
    }
    expect(offered("leggings", "leg-length")).toEqual(["cropped", "full"]);
  });

  it("starts joggers with ribbed cuffs and a drawcord, and leggings with a wide band and a gusset", () => {
    expect(offered("joggers", "leg-finish")).toEqual(["rib-cuff"]);
    expect(defaultOf("joggers", "waistband")).toBe("elastic-drawcord");
    expect(defaultOf("leggings", "waistband")).toBe("wide-band");
    expect(defaultOf("leggings", "gusset")).toBe("crotch-gusset");
    expect(type("leggings").options.some((option) => option.id === "fit")).toBe(false);
    expect(type("leggings").options.some((option) => option.id === "pockets")).toBe(false);
  });

  it("offers a zip at the ankle on track pants only", () => {
    expect(offered("track-pants", "leg-finish")).toEqual(["hem", "ankle-zip"]);
    for (const other of ["shorts", "joggers", "leggings"]) expect(offered(other, "leg-finish")).not.toContain("ankle-zip");
  });

  it("refuses a zip at the ankle on a short leg and says why", () => {
    const shorts = { ...startChoices("track-pants"), "leg-length": "short", "leg-finish": "ankle-zip" };
    expect(checkCombination("track-pants", shorts).map((entry) => entry.ruleId)).toEqual(["ankle-zip-needs-long-leg"]);
  });

  it("draws the waistband, gusset, side stripes and cuffs as panels only when chosen", () => {
    const joggers = startChoices("joggers");
    expect(ids(panelsFor({ typeId: "joggers", options: joggers }))).toEqual(["legs-front", "legs-back", "waistband", "cuffs"]);
    const dressed = { ...joggers, gusset: "crotch-gusset", "side-stripe": "contrast-stripe" };
    expect(ids(panelsFor({ typeId: "joggers", options: dressed }))).toEqual([
      "legs-front",
      "legs-back",
      "waistband",
      "gusset",
      "side-stripes",
      "cuffs",
    ]);
  });

  it("sews the outside leg seam into the stripe when there is a side stripe", () => {
    const plain = ids(seamsFor({ typeId: "joggers", options: startChoices("joggers") }));
    expect(plain).toContain("outside-leg-seam");
    const striped = ids(seamsFor({ typeId: "joggers", options: { ...startChoices("joggers"), "side-stripe": "contrast-stripe" } }));
    expect(striped).toContain("side-stripe-seam");
    expect(striped).not.toContain("outside-leg-seam");
  });

  it("asks for a drawcord and its exits only with a drawcord waistband", () => {
    const joggers = ids(componentSlotsFor({ typeId: "joggers", options: startChoices("joggers") }));
    expect(joggers).toEqual(expect.arrayContaining(["waistband-elastic", "drawcord", "drawcord-exits"]));
    const leggings = ids(componentSlotsFor({ typeId: "leggings", options: startChoices("leggings") }));
    expect(leggings).not.toContain("drawcord");
  });

  it("lets only the leg panels carry artwork", () => {
    expect(ids(BOTTOMS.panels.filter((panel) => panel.anchors.length > 0))).toEqual(["legs-front", "legs-back"]);
  });
});

describe("bottoms construction rules (step 18)", () => {
  it("closes the pocket bags with a seam whenever there are pockets", () => {
    for (const pockets of ["side-seam", "zip-side"]) {
      const seams = seamsFor({ typeId: "track-pants", options: { ...startChoices("track-pants"), pockets } });
      expect(ids(seams), pockets).toContain("pocket-bag-seam");
    }
    const none = seamsFor({ typeId: "track-pants", options: { ...startChoices("track-pants"), pockets: "none" } });
    expect(ids(none)).not.toContain("pocket-bag-seam");
    expect(ids(seamsFor({ typeId: "leggings", options: startChoices("leggings") }))).not.toContain("pocket-bag-seam");
  });

  it("proposes cord ends with a drawcord, marked as a proposal", () => {
    const joggers = componentSlotsFor({ typeId: "joggers", options: startChoices("joggers") });
    const ends = joggers.find((slot) => slot.id === "cord-ends");
    expect(ends?.proposal).toBe(true);
    const elastic = componentSlotsFor({ typeId: "joggers", options: { ...startChoices("joggers"), waistband: "elastic" } });
    expect(ids(elastic)).not.toContain("cord-ends");
  });

  it("uses only seam and stitch classes already in the catalogue", () => {
    const seamClasses = new Set(BOTTOMS.seams.map((seam) => seam.seamClass));
    const stitchClasses = new Set(BOTTOMS.seams.map((seam) => seam.stitchClass));
    expect([...seamClasses].sort()).toEqual(["edge-finishing", "lapped", "superimposed"]);
    expect([...stitchClasses].sort()).toEqual(["four-thread-overedge", "lockstitch", "two-needle-bottom-cover-stitch"]);
  });
});

