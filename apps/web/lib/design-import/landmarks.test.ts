import { describe, expect, it } from "vitest";
import { findBodyLandmarks } from "./landmarks";
import { findOutline } from "./outline";
import { blankRaster, decodeRaster, filledRect } from "./raster";
import { renderTee } from "./fixtures/synthetic";

async function found(options = {}) {
  const tee = await renderTee(options);
  const raster = await decodeRaster(tee.png, 400);
  const outline = findOutline(raster, { x0: 0, y0: 0, x1: 400, y1: 400 });
  if (!outline.ok) throw new Error("no outline");
  return { tee, landmarks: findBodyLandmarks({ data: outline.mask, width: raster.width, bbox: outline.bbox }, "front") };
}

describe("findBodyLandmarks", () => {
  it("finds the tee's landmarks within 6 px of the truth on a 400 px picture", async () => {
    const { tee, landmarks } = await found();
    for (const id of ["hps", "cf-neck", "underarm", "cf-hem", "side-hem", "shoulder-point"] as const) {
      const [a, b] = [landmarks.points[id], tee.landmarks[id]];
      expect(a, id).toBeDefined();
      expect(Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.y ?? 0) - (b?.y ?? 0)), id).toBeLessThan(6);
    }
    expect(landmarks.confidence["cf-neck"]).toBeGreaterThan(0.8);
  });

  it("uses the back names on a back view", async () => {
    const tee = await renderTee();
    const raster = await decodeRaster(tee.png, 400);
    const outline = findOutline(raster, { x0: 0, y0: 0, x1: 400, y1: 400 });
    if (!outline.ok) throw new Error("no outline");
    const back = findBodyLandmarks({ data: outline.mask, width: 400, bbox: outline.bbox }, "back");
    expect(Object.keys(back.points)).toEqual(expect.arrayContaining(["cb-neck", "cb-hem"]));
    expect(back.points["cf-neck"]).toBeUndefined();
  });

  it("is less sure of a sleeveless shape and says so", () => {
    let raster = blankRaster(200, 300, [240, 240, 240]);
    raster = filledRect(raster, { x0: 50, y0: 20, x1: 150, y1: 280 }, [0, 0, 200]);
    const outline = findOutline(raster, { x0: 0, y0: 0, x1: 200, y1: 300 });
    if (!outline.ok) throw new Error("no outline");
    const result = findBodyLandmarks({ data: outline.mask, width: 200, bbox: outline.bbox }, "front");
    expect(result.confidence.underarm).toBeLessThan(0.5);
    expect(result.notes.join(" ")).toMatch(/sleeves/);
    expect(result.confidence["cf-neck"]).toBeLessThan(0.6);
    expect(result.notes.join(" ")).toMatch(/neck/);
  });
});
