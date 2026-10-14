import { describe, expect, it } from "vitest";
import { readMarks, repairGround } from "./marks";
import { fitView } from "./fit";
import { SYNTHETIC_TEMPLATE } from "./fixtures/template";
import { TEE_TRUTH } from "./fixtures/synthetic";
import { blankRaster, filledRect, pixelAt } from "./raster";
import { toStackColours } from "./colours";
import { CROP_FLAG } from "./report";
import type { ReadMark } from "./read";
import { layerSchema, type ViewId } from "@/lib/artwork-stack";
import type { ViewFit } from "./fit";

const fitted = fitView("front", { points: TEE_TRUTH, confidence: { hps: 0.9, "cf-neck": 0.9, underarm: 0.9, "cf-hem": 0.9, "side-hem": 0.9, "shoulder-point": 0.9 } }, SYNTHETIC_TEMPLATE, "flat");
if (!fitted.ok) throw new Error("fit");
const fits = new Map([["front" as const, fitted.fit]]);
const ground = toStackColours([{ lab: [40, 60, 30], rgb: [200, 16, 46], hex: "#c8102e", share: 1 }]);
const garment = filledRect(blankRaster(400, 400, [200, 16, 46]), { x0: 180, y0: 180, x1: 220, y1: 230 }, [255, 255, 255]);

const mark = (over: Partial<ReadMark>): ReadMark => ({ view: "front", kind: "number", text: "10", box: { x: 0.45, y: 0.45, w: 0.1, h: 0.125 }, ...over });
const run = (marks: ReadMark[], f: ReadonlyMap<ViewId, ViewFit> = fits) => readMarks({ marks, readingConfidence: 0.9, raster: garment, fits: f, template: SYNTHETIC_TEMPLATE, colours: ground });

describe("readMarks", () => {
  it("makes a front number a player mark with its ink from the pixels, and every layer is valid", () => {
    const result = run([mark({ lettering: "block" })]);
    const [layer] = result.layers;
    expect(layer).toMatchObject({ kind: "player-mark", place: "front-number", style: "block", provenance: "read-from-image", views: ["front"] });
    expect(layerSchema.safeParse(layer).success).toBe(true);
    expect(result.colours.map((c) => c.screen)).toEqual(["#c8102e", "#ffffff"]);
    expect(layer.kind === "player-mark" && layer.colourId).toBe("colour-2");
    expect(layer.kind === "player-mark" && layer.heightMm).toBeGreaterThan(50);
    expect(result.items[0].confidence).toBeGreaterThan(0.5);
  });

  it("pairs a back name and number into samples, and puts a name elsewhere in a text layer", () => {
    const backFits = new Map([["back" as const, { ...fitted.fit, view: "back" as const }]]);
    const result = run([mark({ view: "back" }), mark({ view: "back", kind: "name", text: "SMITH" })], backFits);
    expect(result.layers.map((l) => l.kind === "player-mark" && l.place)).toEqual(["back-number", "back-name"]);
    expect(result.layers.every((l) => l.kind === "player-mark" && l.sample?.name === "SMITH" && l.sample.number === "10")).toBe(true);
    const text = run([mark({ kind: "name", text: "CLUB FC" })]);
    expect(text.layers[0]).toMatchObject({ kind: "text", text: "CLUB FC", placement: { kind: "anchor" } });
    expect(layerSchema.safeParse(text.layers[0]).success).toBe(true);
  });

  it("crops a crest or sponsor as a flagged graphic and keeps its confidence low", () => {
    const result = run([mark({ kind: "crest", text: undefined }), mark({ kind: "sponsor", text: "ACME" })]);
    expect(result.layers.map((l) => l.kind)).toEqual(["graphic", "graphic"]);
    expect(result.crops.map((c) => c.assetId)).toEqual(["crop-1", "crop-2"]);
    expect(result.items[0].note).toContain(CROP_FLAG);
    expect(result.items.every((i) => i.confidence <= 0.5)).toBe(true);
    expect(layerSchema.safeParse(result.layers[0]).success).toBe(true);
  });

  it("leaves a mark out, and says so, when its view has no fit or its words are unreadable", () => {
    const none = run([mark({ view: "back" })]);
    expect(none.layers).toEqual([]);
    expect(none.items[0].note).toMatch(/back could not be fitted/);
    const blank = run([mark({ kind: "name", text: undefined })]);
    expect(blank.layers).toEqual([]);
    expect(blank.items[0].note).toMatch(/could not be read/);
  });

  it("adds nothing to a view whose template has no landmarks near, and says so", () => {
    const sleeveFits = new Map([["sleeve-left" as const, { ...fitted.fit, view: "sleeve-left" as const }]]);
    const result = run([mark({ view: "sleeve-left" })], sleeveFits);
    expect(result.layers).toEqual([]);
    expect(result.items[0].note).toMatch(/No landmark near/);
  });

  it("adds at most three new inks and none when no ink is found", () => {
    const flat = readMarks({ marks: [mark({})], readingConfidence: 0.9, raster: blankRaster(400, 400, [200, 16, 46]), fits, template: SYNTHETIC_TEMPLATE, colours: ground });
    expect(flat.colours).toHaveLength(1);
    expect(flat.layers[0].kind === "player-mark" && flat.layers[0].colourId).toBeUndefined();
  });
});

describe("repairGround", () => {
  it("fills a mark's box from its neighbours and leaves the original alone", () => {
    const fixed = repairGround(garment, [{ x0: 180, y0: 180, x1: 220, y1: 230 }]);
    expect(pixelAt(fixed, 200, 200)).toEqual([200, 16, 46]);
    expect(pixelAt(garment, 200, 200)).toEqual([255, 255, 255]);
    expect(repairGround(blankRaster(2, 2, [1, 1, 1]), [{ x0: 0, y0: 0, x1: 2, y1: 2 }]).data[0]).toBe(1);
  });
});
