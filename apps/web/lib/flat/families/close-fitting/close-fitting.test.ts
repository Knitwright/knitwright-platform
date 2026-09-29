import { describe, expect, it } from "vitest";
import { buildFlat } from "../../build";
import { designWith, typedIn } from "../../fixtures/designs";
import { madeUpFamilyValues } from "../../fixtures/family-designs";
import type { FlatModel, View } from "../../model";
import { closeFitProblems } from "./index";
import { readCloseFitOptions } from "./options";
import { closeFitProportions } from "./proportions";

const draw = (typeId: string, choices: Record<string, string>, view: View, sized = true): FlatModel => {
  const spec = designWith(typeId, choices, sized ? madeUpFamilyValues(typeId, choices) : undefined);
  const model = buildFlat({ spec, measurements: typedIn(spec), view, colourwayId: "main" });
  if (!model) throw new Error("No drawing");
  return model;
};

const names = (model: FlatModel, layerId: string): string[] =>
  (model.layers.find((layer) => layer.id === layerId)?.elements ?? []).flatMap((element) => (element.kind === "path" ? [element.name] : []));

describe("sleeveless garments drawn to scale", () => {
  it("puts the underarm the armhole depth below the neck, and the strap its width from the neck", () => {
    const values = madeUpFamilyValues("singlet", {});
    const model = draw("singlet", {}, "front");
    expect(model.landmarks["underarm-right"]?.y).toBeCloseTo(values["armhole-depth"] ?? 0, 0);
    expect((model.landmarks["strap-top-right"]?.x ?? 0) - (model.landmarks.hps?.x ?? 0)).toBeCloseTo(values["strap-width"] ?? 0, 0);
    expect(model.landmarks["hem-centre"]?.y).toBeCloseTo(values["body-length"] ?? 0, 0);
  });

  it("narrows the back of a racerback to the back width, on the back view only", () => {
    const values = madeUpFamilyValues("singlet", { "back-style": "racerback" });
    const back = draw("singlet", { "back-style": "racerback" }, "back");
    expect((back.landmarks["back-narrowest-right"]?.x ?? 0) * 2).toBeCloseTo(values["back-width-narrowest"] ?? 0, 0);
    expect(draw("singlet", { "back-style": "racerback" }, "front").landmarks["back-narrowest-right"]).toBeUndefined();
  });
});

describe("what each choice adds to the drawing", () => {
  it("draws binding on the neck and both armholes only with bound edges", () => {
    const bound = draw("singlet", {}, "front");
    expect(names(bound, "panels")).toContain("Edge binding");
    expect(names(bound, "seams")).toEqual(expect.arrayContaining(["Neck binding seam", "Armhole binding seam, right"]));
    const turned = draw("singlet", { "edge-finish": "turned" }, "front");
    expect(names(turned, "panels")).not.toContain("Edge binding");
    expect(names(turned, "stitching")).toContain("Neck edge stitching");
  });

  it("gives a sports bra an underband with its seam, elastic edges and no hem", () => {
    const bra = draw("sports-bra", {}, "front");
    expect(names(bra, "panels")).toContain("Underband");
    expect(names(bra, "seams")).toContain("Underband seam");
    expect(names(bra, "stitching")).toContain("Neck elastic edge stitching");
    expect(names(bra, "stitching")).not.toContain("Hem stitching");
  });

  it("shows both rows of a flat seam inside the side seam, and none for an overlocked seam", () => {
    expect(names(draw("compression-top", {}, "front"), "stitching")).toContain("Flat seam stitching, outer row, right");
    expect(names(draw("compression-top", { "seam-type": "overlock" }, "front"), "stitching")).not.toContain("Flat seam stitching, outer row, right");
    expect(names(draw("singlet", { "seam-type": "flatlock" }, "back"), "stitching")).toContain("Flat seam stitching, inner row, left");
  });

  it("draws a compression top as a tee: sleeves, and a bound or turned neck", () => {
    const top = draw("compression-top", {}, "front");
    expect(names(top, "panels")).toEqual(expect.arrayContaining(["Left sleeve", "Right sleeve", "Edge binding"]));
    expect(names(top, "seams")).toContain("Binding seam");
    expect(names(draw("compression-top", { "edge-finish": "turned" }, "front"), "panels")).toContain("Turned neck edge");
  });
});

describe("measurements that cannot be drawn together", () => {
  const problemsWith = (typeId: string, choices: Record<string, string>, patch: Record<string, number>) => {
    const options = readCloseFitOptions(designWith(typeId, choices));
    return closeFitProblems({ ...closeFitProportions(options), ...patch }, options);
  };

  it("names each problem in plain words", () => {
    expect(problemsWith("singlet", {}, {})).toEqual([]);
    expect(problemsWith("singlet", {}, { "strap-width": 0.4 })).toContain("The neck and the straps together are wider than the chest.");
    expect(problemsWith("singlet", {}, { "armhole-depth": 0.1 })).toContain("The armhole is too shallow for the neck.");
    expect(problemsWith("singlet", {}, { "body-length": 0.5 })).toContain("The body is too short for the armhole.");
    expect(problemsWith("singlet", {}, { "back-width-narrowest": 1.2 })).toContain("The back width does not fit between the armholes.");
    expect(problemsWith("singlet", { "back-style": "racerback" }, { "back-neck-drop": 0.4 })).toContain("The back neck is too deep for the straps of the back.");
    expect(problemsWith("singlet", {}, { "hem-width": 0.3 })).toContain("The bottom edge is too narrow for the chest.");
    expect(problemsWith("compression-top", {}, { "hem-width": 0.2 })).toContain("The hem width is too small compared with the chest.");
  });
});
