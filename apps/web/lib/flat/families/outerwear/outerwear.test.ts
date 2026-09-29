import { describe, expect, it } from "vitest";
import { buildFlat } from "../../build";
import { designWith, typedIn } from "../../fixtures/designs";
import { madeUpFamilyValues } from "../../fixtures/family-designs";
import type { FlatModel, View } from "../../model";
import { readOuterwearOptions } from "./options";
import { outerwearProportions } from "./proportions";
import { outerwearFitProblems } from "./shape";

const draw = (typeId: string, choices: Record<string, string>, view: View, sized = true): FlatModel => {
  const spec = designWith(typeId, choices, sized ? madeUpFamilyValues(typeId, choices) : undefined);
  const model = buildFlat({ spec, measurements: typedIn(spec), view, colourwayId: "main" });
  if (!model) throw new Error("No drawing");
  return model;
};

const names = (model: FlatModel, layerId: string): string[] =>
  (model.layers.find((layer) => layer.id === layerId)?.elements ?? []).flatMap((element) => (element.kind === "path" ? [element.name] : []));

describe("outerwear drawn to scale", () => {
  it("puts the crown of the hood the hood height above the neck, and the zip the zip length above the hem", () => {
    const values = madeUpFamilyValues("zip-hoodie", {});
    const model = draw("zip-hoodie", {}, "front");
    expect(model.landmarks["hood-crown"]?.y).toBeCloseTo(-(values["hood-height"] ?? 0), 0);
    expect((model.landmarks["hem-centre"]?.y ?? 0) - (model.landmarks["zip-top"]?.y ?? 0)).toBeCloseTo(values["zip-length"] ?? 0, 0);
  });

  it("draws the body of a hoodie exactly as a top: its hem the body length below the shoulder", () => {
    const values = madeUpFamilyValues("pullover-hoodie", {});
    expect(draw("pullover-hoodie", {}, "back").landmarks["hem-centre"]?.y).toBeCloseTo(values["body-length"] ?? 0, 0);
  });
});

describe("what each choice adds to the drawing", () => {
  it("draws the hood on both views, its lining from the front only, and its centre seam from the back", () => {
    expect(names(draw("pullover-hoodie", {}, "front"), "panels")).toEqual(expect.arrayContaining(["Hood", "Hood lining"]));
    expect(names(draw("pullover-hoodie", {}, "back"), "panels")).toContain("Hood");
    expect(names(draw("pullover-hoodie", {}, "back"), "panels")).not.toContain("Hood lining");
    expect(names(draw("pullover-hoodie", {}, "back"), "seams")).toContain("Hood centre seam");
  });

  it("shows the inside of a single layer hood, with stitching round the opening", () => {
    const model = draw("pullover-hoodie", { hood: "single-layer" }, "front");
    expect(names(model, "panels")).toContain("Inside of the hood");
    expect(names(model, "stitching")).toContain("Hood opening stitching");
  });

  it("draws the kangaroo pocket on the front only, and the zip on zipped fronts only", () => {
    expect(names(draw("pullover-hoodie", {}, "front"), "panels")).toContain("Kangaroo pocket");
    expect(names(draw("pullover-hoodie", {}, "back"), "panels")).not.toContain("Kangaroo pocket");
    expect(names(draw("zip-hoodie", {}, "front"), "details")).toContain("Zip pull");
    expect(names(draw("pullover-hoodie", {}, "front"), "details")).not.toContain("Zip pull");
  });

  it("draws the drawcord only when chosen", () => {
    expect(names(draw("zip-hoodie", {}, "front"), "details")).toContain("Drawcord, right");
    expect(names(draw("zip-hoodie", { "hood-drawcord": "none" }, "front"), "details")).not.toContain("Drawcord, right");
  });

  it("gives a track jacket a stand collar, or a neckband without one", () => {
    expect(names(draw("track-jacket", {}, "front"), "panels")).toContain("Collar");
    expect(names(draw("track-jacket", { collar: "none" }, "front"), "panels")).toContain("Neckband");
  });

  it("draws rib bands with their seams, and plain hems with stitching", () => {
    const ribbed = draw("zip-hoodie", {}, "front");
    expect(names(ribbed, "panels")).toEqual(expect.arrayContaining(["Hem band", "Cuffs"]));
    expect(names(ribbed, "seams")).toEqual(expect.arrayContaining(["Hem band seam", "Cuff seam, right"]));
    const plain = draw("zip-hoodie", { "hem-finish": "hem", cuffs: "hem" }, "front");
    expect(names(plain, "stitching")).toEqual(expect.arrayContaining(["Hem stitching", "Sleeve hem stitching, right"]));
  });
});

describe("measurements that cannot be drawn together", () => {
  const options = readOuterwearOptions(designWith("zip-hoodie", {}));
  const base = outerwearProportions(options);
  const problemsWith = (patch: Record<string, number>) => outerwearFitProblems({ ...base, ...patch }, options);

  it("names each problem in plain words", () => {
    expect(problemsWith({})).toEqual([]);
    expect(problemsWith({ "hood-width": 0.2 })).toContain("The hood is too narrow for the neck opening.");
    expect(problemsWith({ "hood-height": 0.2 })).toContain("The hood is too low to reach over the head.");
    expect(problemsWith({ "zip-length": 0.5 })).toContain("The zip does not reach from the hem up to the neck.");
    expect(problemsWith({ "pocket-opening": 1 })).toContain("The pocket does not fit on the front.");
    expect(problemsWith({ "cuff-height": 0.6 })).toContain("The cuff is too deep for the sleeve.");
    expect(problemsWith({ "hem-band-height": 0.5 })).toContain("The hem band is too deep for the body.");
  });
});
