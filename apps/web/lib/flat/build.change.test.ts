import { describe, expect, it } from "vitest";
import { listTypes, pointsOfMeasureFor, type Artwork, type GarmentSpec } from "@/lib/garment";
import { buildFlat } from "./build";
import { designWith, madeUpValues, typedIn } from "./fixtures/designs";
import type { FlatModel, View } from "./model";
import { TOPS_TEMPLATES, templateFor } from "./templates";

const draw = (spec: GarmentSpec, view: View = "front", colourwayId = "main"): FlatModel => {
  const model = buildFlat({ spec, measurements: typedIn(spec), view, colourwayId });
  if (!model) throw new Error("No drawing");
  return model;
};

const layerJson = (model: FlatModel): Record<string, string> =>
  Object.fromEntries(model.layers.map((layer) => [layer.id, JSON.stringify(layer.elements)]));

const changedLayers = (before: FlatModel, after: FlatModel): string[] => {
  const a = layerJson(before);
  const b = layerJson(after);
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((id) => a[id] !== b[id]).sort();
};

describe("every tops type has a template", () => {
  it("covers each type in the registry, so a new type without a template is noticed", () => {
    for (const type of listTypes("tops")) expect(templateFor(type.id), type.id).toBeDefined();
    expect(TOPS_TEMPLATES.map((template) => template.typeId).sort()).toEqual(listTypes("tops").map((type) => type.id).sort());
  });

  it("gives proportions for every point of measure the type has, as ratios rather than lengths", () => {
    for (const type of listTypes("tops")) {
      const spec = designWith(type.id, {});
      const ratios = templateFor(type.id)?.proportions({ raglan: false, neck: "round", collar: "none", placket: "none", longSleeve: false, hem: "straight", sidePanels: false, cuffs: false }) ?? {};
      for (const point of pointsOfMeasureFor(spec)) expect(ratios[point.id], `${type.id} ${point.id}`).toBeGreaterThan(0);
      expect(ratios["chest-width"]).toBe(1);
      for (const ratio of Object.values(ratios)) expect(ratio).toBeLessThan(3);
    }
  });
});

describe("M3: changing one measurement changes the drawing", () => {
  const values = madeUpValues({});
  const spec = designWith("crew-tee", {}, values);

  it.each(Object.keys(values).filter((id) => pointsOfMeasureFor(spec).some((point) => point.id === id)))(
    "%s",
    (pointId) => {
      const view: View = pointId === "back-neck-drop" ? "back" : "front";
      const bigger = designWith("crew-tee", {}, { ...values, [pointId]: Math.round((values[pointId] as number) * 1.04) });
      const before = draw(spec, view);
      const after = draw(bigger, view);
      expect(after.toScale).toBe(true);
      expect(JSON.stringify(after.layers)).not.toBe(JSON.stringify(before.layers));
    },
  );

  it("also holds for the parts a polo adds", () => {
    const choices = { placket: "buttons" };
    const polo = madeUpValues(choices);
    const base = designWith("polo", choices, polo);
    for (const pointId of ["collar-height", "placket-length", "placket-width"]) {
      const changed = designWith("polo", choices, { ...polo, [pointId]: (polo[pointId] as number) + 60 });
      expect(JSON.stringify(draw(changed).layers), pointId).not.toBe(JSON.stringify(draw(base).layers));
    }
  });

  it("a measurement typed into a design that had none changes the drawing and its shape", () => {
    const bare = draw(designWith("crew-tee", {}));
    const one = draw(designWith("crew-tee", {}, { "chest-width": 6400 }));
    expect(one.toScale).toBe(false);
    expect(one.bounds.maxX - one.bounds.minX).toBeGreaterThan(bare.bounds.maxX - bare.bounds.minX);
    expect(one.missing.map((point) => point.pointId)).not.toContain("chest-width");
  });
});

describe("changing an option changes only the layers it should", () => {
  const measured = (choices: Record<string, string>) => draw(designWith("team-jersey", choices, madeUpValues(choices)));
  const base = { placket: "buttons", collar: "band-collar" };

  it("swapping buttons for a zip changes the details and nothing else", () => {
    expect(changedLayers(measured(base), measured({ ...base, placket: "zip" }))).toEqual(["details"]);
  });

  it("the fit is not drawn, so changing it changes nothing", () => {
    expect(changedLayers(measured(base), measured({ ...base, fit: "slim" }))).toEqual([]);
  });

  it("adding side vents changes only the details, since the hem outline stays straight", () => {
    expect(changedLayers(measured(base), measured({ ...base, "hem-shape": "side-vent" }))).toEqual(["details"]);
  });

  it("curving the hem changes the outline and the stitching but not the details", () => {
    expect(changedLayers(measured(base), measured({ ...base, "hem-shape": "curved" }))).toEqual(["panels", "seams", "stitching"]);
  });

  it("adding rib cuffs changes the sleeves, their seams and their stitching, not the details", () => {
    expect(changedLayers(measured(base), measured({ ...base, cuffs: "rib-cuff" }))).toEqual(["panels", "seams", "stitching"]);
  });

  it("changing the sleeve length changes the sleeves only", () => {
    const changed = changedLayers(measured(base), measured({ ...base, "sleeve-length": "long" }));
    expect(changed).toEqual(["panels", "seams", "stitching"]);
  });

  it("raglan and set-in sleeves are drawn differently: the raglan seam runs from the underarm up to the neck", () => {
    const setIn = measured({});
    const raglan = measured({ "sleeve-type": "raglan" });
    const seams = (model: FlatModel) => model.layers.find((layer) => layer.id === "seams")?.elements.flatMap((e) => (e.kind === "path" ? [e.name] : [])) ?? [];
    expect(seams(setIn)).toContain("Shoulder seam, right");
    expect(seams(raglan)).not.toContain("Shoulder seam, right");
    expect(changedLayers(setIn, raglan)).toEqual(expect.arrayContaining(["panels", "seams"]));
    const armhole = raglan.layers.find((layer) => layer.id === "seams")?.elements.find((e) => e.kind === "path" && e.name === "Armhole seam, right");
    if (armhole?.kind !== "path") throw new Error("No seam");
    const first = armhole.commands[0];
    const last = armhole.commands.at(-1);
    if (first?.op !== "M" || last?.op !== "C") throw new Error("Unexpected seam");
    expect(first.to.y).toBe(0);
    expect(last.to).toEqual(raglan.landmarks["underarm-right"]);
    expect(first.to.x).toBeLessThan(setIn.landmarks["sleeve-start-right"]!.x);
  });

  it("the back neckline is shallower than the front", () => {
    const spec = designWith("crew-tee", {}, madeUpValues({}));
    const depth = (model: FlatModel): number => {
      const band = model.layers[0]?.elements.find((e) => e.kind === "path" && e.panelId === "neckband");
      if (band?.kind !== "path") throw new Error("No neckband");
      return Math.max(...band.commands.flatMap((c) => (c.op === "Z" ? [] : [c.to.y])));
    };
    expect(depth(draw(spec, "back"))).toBeLessThan(depth(draw(spec, "front")));
  });

  it("changing a colour changes the panels and nothing else", () => {
    const spec = designWith("crew-tee", {}, madeUpValues({}));
    const painted = {
      ...spec,
      colourways: [{ ...spec.colourways[0], colours: [{ panelId: "body-front", colour: "Red", swatch: "#aa0000", provenance: "user-edited" as const }] }],
    } as GarmentSpec;
    expect(changedLayers(draw(spec), draw(painted))).toEqual(["panels"]);
  });
});

describe("artwork", () => {
  const art = (patch: Partial<Artwork>): Artwork => ({
    id: "a1",
    name: "Logo",
    source: { kind: "file", fileId: "6f0b1c1e-6a3b-4f6e-9f43-0f5f3a1a2b11" },
    panelId: "body-front",
    anchor: "centre-chest",
    offsetX: 100,
    offsetY: -50,
    width: 600,
    height: 400,
    rotationDegrees: 15,
    technique: "screen-print",
    provenance: "user-edited",
    ...patch,
  });
  const base = designWith("crew-tee", {}, madeUpValues({}));
  const withArt = (...items: Artwork[]): GarmentSpec => ({ ...base, artwork: items });
  const elements = (model: FlatModel) => model.layers.find((layer) => layer.id === "artwork")?.elements ?? [];

  it("places a picture at its anchor plus the offset, with its size and turn, in the artwork layer only", () => {
    const model = draw(withArt(art({})));
    const [image] = elements(model);
    expect(image).toMatchObject({ kind: "image", width: 600, height: 400, rotation: 15 });
    expect(changedLayers(draw(base), model)).toEqual(["artwork"]);
    const moved = draw(withArt(art({ offsetX: 300 })));
    const [other] = elements(moved);
    if (image?.kind !== "image" || other?.kind !== "image") throw new Error("Expected pictures");
    expect(other.at.x - image.at.x).toBe(200);
    expect(other.at.y).toBe(image.at.y);
  });

  it("draws text artwork as text, at the anchor", () => {
    const [text] = elements(draw(withArt(art({ source: { kind: "text", text: "HOME" }, height: 300, rotationDegrees: 0 }))));
    expect(text).toMatchObject({ kind: "text", text: "HOME", size: 300, anchor: "middle" });
  });

  it("shows front panels on the front only, back panels on the back only, and sleeve artwork on the front", () => {
    const mixed = withArt(art({ id: "f" }), art({ id: "b", panelId: "body-back", anchor: "centre-back" }), art({ id: "s", panelId: "sleeve-left", anchor: "sleeve-centre" }));
    expect(elements(draw(mixed, "front"))).toHaveLength(2);
    expect(elements(draw(mixed, "back"))).toHaveLength(1);
  });

  it("puts the wearer's left sleeve on the right of the page in the front view", () => {
    const left = elements(draw(withArt(art({ panelId: "sleeve-left", anchor: "sleeve-centre", offsetX: 0, offsetY: 0 }))))[0];
    const right = elements(draw(withArt(art({ panelId: "sleeve-right", anchor: "sleeve-centre", offsetX: 0, offsetY: 0 }))))[0];
    if (left?.kind !== "image" || right?.kind !== "image") throw new Error("Expected pictures");
    expect(left.at.x).toBeGreaterThan(0);
    expect(right.at.x).toBeLessThan(0);
    expect(left.at.x).toBeCloseTo(-right.at.x, 6);
  });

  it("puts every anchor of the registry somewhere sensible on the drawing", () => {
    const anchors: [string, string][] = [
      ["body-front", "centre-chest"], ["body-front", "left-chest"], ["body-front", "right-chest"], ["body-front", "lower-front"],
    ];
    const points = anchors.map(([panelId, anchor]) => {
      const [image] = elements(draw(withArt(art({ panelId, anchor, offsetX: 0, offsetY: 0 }))));
      if (image?.kind !== "image") throw new Error("Expected a picture");
      return image.at;
    });
    expect(points[1]!.x).toBeGreaterThan(0);
    expect(points[2]!.x).toBeLessThan(0);
    expect(points[3]!.y).toBeGreaterThan(points[0]!.y);
    const back = ["upper-back", "centre-back", "lower-back"].map((anchor) => {
      const [image] = elements(draw(withArt(art({ panelId: "body-back", anchor, offsetX: 0, offsetY: 0 })), "back"));
      if (image?.kind !== "image") throw new Error("Expected a picture");
      return image.at.y;
    });
    expect(back[0]).toBeLessThan(back[1]!);
    expect(back[1]).toBeLessThan(back[2]!);
  });

  it("skips artwork on an anchor the drawing does not know", () => {
    expect(elements(draw(withArt(art({ anchor: "nowhere" }))))).toEqual([]);
  });
});
