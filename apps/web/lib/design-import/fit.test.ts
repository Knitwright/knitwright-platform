import { describe, expect, it } from "vitest";
import { TOO_FEW_LANDMARKS, fitView, onPieceFraction, toDesign, toPicture, warpToDesign } from "./fit";
import { SYNTHETIC_TEMPLATE } from "./fixtures/template";
import { TEE_TRUTH, renderTee } from "./fixtures/synthetic";
import { blankRaster, decodeRaster, pixelAt } from "./raster";
import type { PieceMapper } from "@/lib/artwork-stack";
import type { LandmarkSet } from "./types";

const allSure = (points: LandmarkSet) => ({ points, confidence: Object.fromEntries(Object.keys(points).map((id) => [id, 0.9])) });

describe("fitView", () => {
  it("fits a flat by an affine map with no residual and maps both ways", () => {
    const result = fitView("front", allSure(TEE_TRUTH), SYNTHETIC_TEMPLATE, "flat");
    if (!result.ok) throw new Error(result.reason);
    expect(result.fit.model).toBe("affine");
    expect(result.fit.rmsMm).toBeLessThan(0.05);
    expect(result.fit.mmPerPixel).toBeCloseTo(1.5, 2);
    expect(toDesign(result.fit, { x: 200, y: 70 })).toEqual({ x: 0, y: 0 });
    const back = toPicture(result.fit, { x: 0, y: 0 });
    expect(back.x).toBeCloseTo(200, 3);
    expect(result.fit.confidence).toBeGreaterThan(0.75);
  });

  it("takes out perspective for a photo with a homography, where an affine map cannot", async () => {
    const photo = await renderTee({ keystone: 0.0006 });
    const asPhoto = fitView("front", allSure(photo.landmarks), SYNTHETIC_TEMPLATE, "worn-photo");
    const asFlat = fitView("front", allSure(photo.landmarks), SYNTHETIC_TEMPLATE, "mockup");
    if (!asPhoto.ok || !asFlat.ok) throw new Error("no fit");
    expect(asPhoto.fit.model).toBe("homography");
    expect(asPhoto.fit.rmsMm).toBeLessThan(0.1);
    expect(asFlat.fit.rmsMm).toBeGreaterThan(asPhoto.fit.rmsMm * 5);
    expect(asPhoto.fit.notes.join(" ")).toMatch(/Photo, approximate/);
  });

  it("falls back to an affine map for a photo with fewer than four landmarks, and says so", () => {
    const three = allSure({ hps: TEE_TRUTH.hps, "cf-neck": TEE_TRUTH["cf-neck"], "cf-hem": TEE_TRUTH["cf-hem"] });
    const result = fitView("front", three, SYNTHETIC_TEMPLATE, "worn-photo");
    if (!result.ok) throw new Error(result.reason);
    expect(result.fit.model).toBe("affine");
    expect(result.fit.notes.join(" ")).toMatch(/Fewer than four/);
  });

  it("refuses a view with fewer than three landmarks, or three on one line", () => {
    const two = allSure({ hps: TEE_TRUTH.hps, "cf-neck": TEE_TRUTH["cf-neck"] });
    expect(fitView("front", two, SYNTHETIC_TEMPLATE, "flat")).toEqual({ ok: false, reason: TOO_FEW_LANDMARKS });
    const line = allSure({ "cf-neck": { x: 200, y: 70 }, "cf-hem": { x: 200, y: 330 }, underarm: { x: 200, y: 120 } });
    expect(fitView("front", line, SYNTHETIC_TEMPLATE, "flat").ok).toBe(false);
    expect(fitView("sleeve-left", allSure(TEE_TRUTH), SYNTHETIC_TEMPLATE, "flat").ok).toBe(false);
  });

  it("counts how much of the outline lands on the piece through the mapper", () => {
    const result = fitView("front", allSure(TEE_TRUTH), SYNTHETIC_TEMPLATE, "flat");
    if (!result.ok) throw new Error(result.reason);
    const leftOnly: PieceMapper = { toPiece: (view, p) => (p.x < 0 ? { pieceId: view, xMm: p.x, yMm: p.y } : null) };
    const outline = [{ x: 100, y: 100 }, { x: 150, y: 100 }, { x: 250, y: 100 }, { x: 300, y: 100 }];
    expect(onPieceFraction(result.fit, outline, leftOnly, "S")).toBe(0.5);
    expect(onPieceFraction(result.fit, [], leftOnly, "S")).toBe(0);
  });
});

describe("warpToDesign", () => {
  it("resamples the picture into design space and leaves the outside empty", async () => {
    const result = fitView("front", allSure(TEE_TRUTH), SYNTHETIC_TEMPLATE, "flat");
    if (!result.ok) throw new Error(result.reason);
    const tee = await decodeRaster((await renderTee()).png, 400);
    const warped = warpToDesign(tee, result.fit, { minX: -300, minY: -150, maxX: 300, maxY: 450 }, 3);
    expect(warped.width).toBe(200);
    expect(warped.height).toBe(200);
    // design (0, 100) is the picture's centre, below the neck: the garment colour.
    expect(pixelAt(warped, 100, 83)).toEqual([200, 16, 46]);
    const small = warpToDesign(blankRaster(10, 10, [1, 2, 3]), result.fit, { minX: 5000, minY: 5000, maxX: 5003, maxY: 5003 }, 3);
    expect(Array.from(small.data.slice(0, 4))).toEqual([0, 0, 0, 0]);
  });
});
