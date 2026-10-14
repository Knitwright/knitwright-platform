import { describe, expect, it } from "vitest";
import { ANCHOR_IDS, VIEW_ANCHORS, VIEW_IDS, isLandmarkOf, viewOfPanel } from "./anchors";
import { DEFAULT_KIND_RANK, blendNeedsRaster, type Blend, blendProblems, inDefaultOrder } from "./blend";
import { colourWords, resolveColour, type StackColour, type StackColourway } from "./colours";
import { DEFAULT_DATUM, resolveDatum } from "./datum";
import { createFakeAssetReader, createFakePieceMapper } from "./fakes";
import { canonicalDisplayList, paramProblems, type PatternGenerator } from "./generator";
import { mmFromTenths, roundMm, tenthsFromMm } from "./units";

describe("units", () => {
  it("rounds to 0.01 mm and moves between tenths and millimetres without drift", () => {
    expect(roundMm(1.005 + 0.0000001)).toBe(1.01);
    expect(roundMm(-0)).toBe(0);
    expect(mmFromTenths(123)).toBe(12.3);
    expect(tenthsFromMm(12.3)).toBe(123);
    expect(tenthsFromMm(-0.04)).toBe(0);
  });
});

describe("views and anchors", () => {
  it("names the anchors of every view from the pattern landmarks", () => {
    for (const view of VIEW_IDS) {
      expect(VIEW_ANCHORS[view].every((id) => ANCHOR_IDS.includes(id))).toBe(true);
    }
    expect(isLandmarkOf("front", "underarm")).toBe(true);
    expect(isLandmarkOf("front", "cb-neck")).toBe(false);
    expect(isLandmarkOf("front", "centre-chest")).toBe(false);
  });

  it("puts a panel on its view", () => {
    expect(viewOfPanel("body-front")).toBe("front");
    expect(viewOfPanel("body-back")).toBe("back");
    expect(viewOfPanel("legs-back")).toBe("back");
    expect(viewOfPanel("sleeve-right")).toBe("sleeve-right");
    expect(viewOfPanel("collar")).toBe("collar");
    expect(viewOfPanel("legs-front")).toBe("front");
  });
});

describe("blend order", () => {
  const layer = (id: string, kind: keyof typeof DEFAULT_KIND_RANK, blend: Blend = "normal") => ({ id, kind, blend, views: ["front"] });

  it("says which blends need pixels", () => {
    expect(["normal", "knock-out"].some((blend) => blendNeedsRaster(blend as "normal"))).toBe(false);
    expect(["multiply", "screen", "overlay"].every((blend) => blendNeedsRaster(blend as "multiply"))).toBe(true);
  });

  it("puts each kind in its default place and keeps the order within a kind", () => {
    const ordered = inDefaultOrder([layer("m", "player-mark"), layer("b", "graphic"), layer("a", "graphic"), layer("g", "ground"), layer("p", "pattern")]);
    expect(ordered.map((entry) => entry.id)).toEqual(["g", "p", "b", "a", "m"]);
  });

  it("finds no problem in a sound order, and ignores layers on other views", () => {
    expect(blendProblems([layer("g", "ground"), layer("p", "pattern", "multiply")])).toEqual([]);
    expect(blendProblems([{ ...layer("g", "ground"), views: ["back"] }, layer("p", "pattern", "multiply")])).toHaveLength(1);
  });
});

describe("colours", () => {
  const colours: StackColour[] = [{ id: "red", role: "x", screen: "#ff0000", codes: [], provenance: "user-edited" }];
  const colourways: StackColourway[] = [
    { id: "away", name: "Away", colours: { red: { screen: "#0000ff", codes: [{ system: "pantone-tcx", value: "19-4052", source: "user-edited" }], provenance: "user-edited" } } },
  ];

  it("takes a colour from the colourway, else from the colour list, else nothing", () => {
    expect(resolveColour({ colours, colourways }, "away", "red")?.screen).toBe("#0000ff");
    expect(resolveColour({ colours, colourways }, "home", "red")?.screen).toBe("#ff0000");
    expect(resolveColour({ colours, colourways }, undefined, "red")?.screen).toBe("#ff0000");
    expect(resolveColour({ colours, colourways }, "away", "green")).toBeUndefined();
  });

  it("shows a code as the person typed it, else the screen colour, else says none is chosen", () => {
    expect(colourWords(resolveColour({ colours, colourways }, "away", "red"))).toBe("Pantone TCX 19-4052");
    expect(colourWords({ codes: [{ system: "custom", value: "Navy", source: "user-edited" }], provenance: "derived" })).toBe("Navy");
    expect(colourWords({ screen: "#ff0000", codes: [], provenance: "derived" })).toBe("screen colour #ff0000");
    expect(colourWords({ codes: [], provenance: "derived" })).toBe("a colour not yet chosen");
    expect(colourWords(undefined)).toBe("a colour not yet chosen");
  });
});

describe("the repeat datum", () => {
  it("sits on the centre line at the underarm, moved by the offset", () => {
    expect(resolveDatum(DEFAULT_DATUM, { x: 100, y: 250 })).toEqual({ x: 0, y: 250 });
    expect(resolveDatum({ anchor: "chest-line", offsetMm: { x: 5.004, y: -10 } }, { x: 100, y: 250 })).toEqual({ x: 5, y: 240 });
    expect(resolveDatum(DEFAULT_DATUM, undefined)).toEqual({ x: 0, y: 0 });
  });
});

describe("generators", () => {
  const generator: Pick<PatternGenerator, "label" | "params"> = {
    label: "Dots",
    params: [{ id: "flip", label: "Flip", unit: "yes-no", min: 0, max: 1, step: 1, default: null }, { id: "diameterMm", label: "Dot size", unit: "mm", min: 5, max: 100, step: 1, default: 30 }, { id: "ratio", label: "Spread", unit: "none", min: 0, max: 1, step: 0.1, default: 0.5 }],
  };

  it("names settings that are unknown, not numbers or out of range", () => {
    expect(paramProblems(generator, { diameterMm: 30 })).toEqual([]);
    expect(paramProblems(generator, { size: 3 })).toEqual(["Dots has no setting called size."]);
    expect(paramProblems(generator, { diameterMm: "big" })).toEqual(["Dot size must be a number."]);
    expect(paramProblems(generator, { diameterMm: 500 })).toEqual(["Dot size must be between 5 and 100 mm."]);
    expect(paramProblems(generator, { ratio: 2 })).toEqual(["Spread must be between 0 and 1."]);
    expect(paramProblems(generator, { flip: true })).toEqual([]);
    expect(paramProblems(generator, { flip: 1 })).toEqual(["Flip must be yes or no."]);
  });

  it("writes a display list as the same text on any machine", () => {
    const list = { shapes: [{ kind: "polygon" as const, fill: "#fff", points: [{ x: 0.001, y: 1.2349 }] }, { kind: "circle" as const, fill: "#000", centre: { x: 1, y: 2 }, radius: 3.14159 }] };
    expect(canonicalDisplayList(list)).toBe('[["p","#fff",[[0,1.23]]],["c","#000",1,2,3.14]]');
  });
});

describe("fakes for the code that builds against the interfaces", () => {
  it("maps a point to a piece named after its view and leaves the coordinates alone", () => {
    expect(createFakePieceMapper().toPiece("back", { x: 1, y: 2 }, "48")).toEqual({ pieceId: "back", xMm: 1, yMm: 2 });
  });

  it("reads an asset it was given and nothing else", async () => {
    const reader = createFakeAssetReader([{ id: "a", kind: "raster", widthPx: 10, heightPx: 20 }]);
    const found = await reader.getAsset("a");
    expect(found).toMatchObject({ id: "a", widthPx: 10, hasAlpha: false, colourSpace: "srgb" });
    expect((await found?.readPrintCopy())?.byteLength).toBe(0);
    expect((await found?.readScreenCopy())?.byteLength).toBe(0);
    expect(await reader.getAsset("b")).toBeNull();
  });
});
