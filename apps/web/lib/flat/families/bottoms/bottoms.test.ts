import { describe, expect, it } from "vitest";
import { buildFlat } from "../../build";
import { designWith, typedIn } from "../../fixtures/designs";
import { madeUpFamilyValues } from "../../fixtures/family-designs";
import type { FlatModel, View } from "../../model";
import { bottomsBasisOf } from "./shape";
import { bottomsProportions } from "./proportions";
import { readBottomsOptions } from "./options";

const draw = (typeId: string, choices: Record<string, string>, view: View, sized = true): FlatModel => {
  const values = sized ? madeUpFamilyValues(typeId, choices) : undefined;
  const spec = designWith(typeId, choices, values);
  const model = buildFlat({ spec, measurements: typedIn(spec), view, colourwayId: "main" });
  if (!model) throw new Error("No drawing");
  return model;
};

const names = (model: FlatModel, layerId: string): string[] =>
  (model.layers.find((layer) => layer.id === layerId)?.elements ?? []).flatMap((element) => (element.kind === "path" ? [element.name] : []));

describe("bottoms drawn to scale", () => {
  const values = madeUpFamilyValues("joggers", {});
  const model = draw("joggers", {}, "front");

  it("puts the hem at the length of the rise and the inside leg below the waist", () => {
    const basis = bottomsBasisOf(
      Object.fromEntries(Object.entries(bottomsProportions(readBottomsOptions(designWith("joggers", {})))).map(([id, ratio]) => [id, values[id] ?? ratio])),
      readBottomsOptions(designWith("joggers", {})),
    ).basis;
    expect(basis).not.toBeNull();
    const hem = model.landmarks["hem-outside-right"];
    const crotch = model.landmarks.crotch;
    expect(hem?.y).toBeCloseTo((crotch?.y ?? 0) + (values.inseam ?? 0), 0);
    expect(model.landmarks["waist-right"]?.x).toBeCloseTo((values["waist-relaxed"] ?? 0) / 2, 0);
    expect((model.landmarks["hem-outside-right"]?.x ?? 0) - (model.landmarks["hem-inside-right"]?.x ?? 0)).toBeCloseTo(values["leg-opening"] ?? 0, 0);
  });

  it("keeps the legs apart at the hem, and joins them only at the crotch", () => {
    expect(model.landmarks["hem-inside-right"]?.x).toBeGreaterThan(0);
    expect(model.landmarks.crotch?.x).toBe(0);
  });
});

describe("what each choice adds to the drawing", () => {
  it("draws a drawcord only on the front of a drawcord waistband", () => {
    expect(names(draw("joggers", {}, "front"), "details")).toContain("Drawcord, right");
    expect(names(draw("joggers", {}, "back"), "details")).not.toContain("Drawcord, right");
    expect(names(draw("joggers", { waistband: "elastic" }, "front"), "details")).not.toContain("Drawcord, right");
  });

  it("draws ribbed cuffs with a seam, and a hem with stitching", () => {
    const joggers = draw("joggers", {}, "front");
    expect(names(joggers, "panels")).toContain("Cuffs");
    expect(names(joggers, "seams")).toContain("Cuff seam, right");
    expect(names(joggers, "stitching")).not.toContain("Leg hem stitching, right");
    expect(names(draw("track-pants", {}, "front"), "stitching")).toContain("Leg hem stitching, right");
  });

  it("sews the stripe in place of the outside leg seam, on both views", () => {
    for (const view of ["front", "back"] as const) {
      const striped = draw("track-pants", { "side-stripe": "contrast-stripe" }, view);
      expect(names(striped, "panels")).toContain("Side stripes");
      expect(names(striped, "seams")).toContain("Side stripe seam, right");
      expect(names(striped, "seams")).not.toContain("Outside leg seam, right");
    }
  });

  it("shows the gusset from the front only, and zips where they are chosen", () => {
    expect(names(draw("leggings", {}, "front"), "panels")).toContain("Gusset");
    expect(names(draw("leggings", {}, "back"), "panels")).not.toContain("Gusset");
    expect(names(draw("track-pants", { "leg-finish": "ankle-zip" }, "back"), "details")).toContain("Ankle zip teeth, right");
    expect(names(draw("track-pants", { pockets: "zip-side" }, "front"), "details")).toContain("Pocket zip teeth, right");
    expect(names(draw("track-pants", { pockets: "side-seam" }, "front"), "details")).toContain("Pocket opening, right");
  });

  it("gives shorts no knee, so a short leg is one straight run from the crotch", () => {
    const options = readBottomsOptions(designWith("shorts", {}));
    expect(bottomsBasisOf(bottomsProportions(options), options).basis?.knee).toBeNull();
  });

  it("names the rise seam of the view it draws", () => {
    expect(names(draw("shorts", {}, "front"), "seams")).toContain("Front rise seam");
    expect(names(draw("shorts", {}, "back"), "seams")).toContain("Back rise seam");
  });
});

describe("measurements that cannot be drawn together", () => {
  const options = readBottomsOptions(designWith("joggers", {}));
  const base = bottomsProportions(options);
  const problemsWith = (patch: Record<string, number>) => bottomsBasisOf({ ...base, ...patch }, options).problems;

  it("names each problem in plain words", () => {
    expect(problemsWith({ "waist-relaxed": 1.2 })).toContain("The waist is wider than the hip.");
    expect(problemsWith({ "waist-stretched": 0.5 })).toContain("The stretched waist is smaller than the relaxed waist.");
    expect(problemsWith({ "waistband-height": 0.5 })).toContain("The waistband is too deep for the rise.");
    expect(problemsWith({ thigh: 0.2 })).toContain("The thigh does not fit the hip.");
    expect(problemsWith({ "leg-opening": 0.7 })).toContain("The leg opening is wider than the thigh.");
    expect(problemsWith({ knee: 0.6 })).toContain("The knee is not between the thigh and the leg opening.");
    expect(problemsWith({ outseam: 3 })).toContain("The outside leg does not match the rise and the inside leg.");
    expect(problemsWith({ "back-rise": 0.4 })).toContain("The back rise is shorter than the front rise.");
  });
});
