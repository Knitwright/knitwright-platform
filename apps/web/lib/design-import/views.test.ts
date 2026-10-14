import { describe, expect, it } from "vitest";
import { analyseViews } from "./views";
import { SYNTHETIC_TEMPLATE } from "./fixtures/template";
import { FRONT_ONLY_REPLY } from "./fixtures/replies";
import { TEE_TRUTH, renderTee } from "./fixtures/synthetic";
import { blankRaster, decodeRaster } from "./raster";
import { readingSchema } from "./read";

const reading = (over: object = {}) => readingSchema.parse({ ...FRONT_ONLY_REPLY, ...over });

describe("analyseViews", () => {
  it("finds the outline and landmarks of a view", async () => {
    const raster = await decodeRaster((await renderTee()).png, 400);
    const { analyses, failures } = analyseViews(raster, reading(), SYNTHETIC_TEMPLATE);
    expect(failures).toEqual([]);
    expect(analyses[0].sources["cf-neck"]).toBe("found");
    expect(analyses[0].points.underarm?.x).toBeCloseTo(285, -1);
  });

  it("uses the model's guess only where the picture gave nothing, with low certainty", async () => {
    const raster = await decodeRaster((await renderTee()).png, 400);
    const template = { ...SYNTHETIC_TEMPLATE, landmarks: (view: "front") => ({ ...SYNTHETIC_TEMPLATE.landmarks(view), "cap-top": { x: 0, y: -50 } }) };
    const guessed = reading({ landmarks: [{ view: "front", points: { "cap-top": { x: 0.5, y: 0.05 }, hps: { x: 0.1, y: 0.1 } } }] });
    const { analyses } = analyseViews(raster, guessed, template);
    expect(analyses[0].sources["cap-top"]).toBe("guess");
    expect(analyses[0].points["cap-top"]).toEqual({ x: 200, y: 20 });
    expect(analyses[0].confidence["cap-top"]).toBe(0.3);
    expect(analyses[0].sources.hps).toBe("found");
  });

  it("lets a landmark the user moved win, at high certainty", async () => {
    const raster = await decodeRaster((await renderTee()).png, 400);
    const { analyses } = analyseViews(raster, reading(), SYNTHETIC_TEMPLATE, { front: { hps: { x: 0.5, y: 0.2 } } });
    expect(analyses[0].points.hps).toEqual({ x: 200, y: 80 });
    expect(analyses[0].sources.hps).toBe("moved");
    expect(analyses[0].confidence.hps).toBe(0.95);
    expect(TEE_TRUTH.hps).toBeDefined();
  });

  it("names a view with no garment, and a view that is not a body", async () => {
    const empty = blankRaster(100, 100, [240, 240, 240]);
    const out = analyseViews(empty, reading({ views: [{ view: "front", box: { x: 0, y: 0, w: 1, h: 1 } }, { view: "sleeve-left", box: { x: 0, y: 0, w: 0.5, h: 0.5 } }] }), SYNTHETIC_TEMPLATE);
    expect(out.analyses).toEqual([]);
    expect(out.failures.map((f) => f.view)).toEqual(["front", "sleeve-left"]);
    expect(out.failures[1].sentence).toMatch(/left sleeve could not be fitted/);
  });
});
