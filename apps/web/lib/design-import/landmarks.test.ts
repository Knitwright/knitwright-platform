import { describe, expect, it } from "vitest";
import type { Pt } from "./geometry";
import { applyHandleEdits, findLandmarks, landmarkAt, type LandmarkHint } from "./landmarks";
import { findOutline, type Outline } from "./outline";
import { TEE, fillPolygon, teeGeometry, teePicture, warpRaster } from "./fixtures/synthetic";

const NAVY = [27, 42, 73] as const;
const close = (a: Pt | undefined, b: Pt, pixels: number): void => {
  expect(a).toBeDefined();
  expect(Math.hypot(a!.x - b.x, a!.y - b.y)).toBeLessThanOrEqual(pixels);
};
const outlineOf = (raster = teePicture({ garment: NAVY })): Outline => findOutline(raster).value as Outline;

describe("findLandmarks on a flat tee", () => {
  const found = findLandmarks(outlineOf());
  const { truth, left } = teeGeometry();

  it("puts every landmark within 6 pixels of the truth, on both sides", () => {
    expect(found.confidence).toBeGreaterThan(0.7);
    for (const id of ["hps", "shoulder-point", "underarm", "side-hem"] as const) {
      close(landmarkAt(found.value, id, "right")?.at, truth[id] as Pt, 6);
      close(landmarkAt(found.value, id, "left")?.at, left[id] as Pt, 6);
    }
    close(landmarkAt(found.value, "cf-neck", "centre")?.at, truth["cf-neck"] as Pt, 6);
    close(landmarkAt(found.value, "cf-hem", "centre")?.at, truth["cf-hem"] as Pt, 6);
  });

  it("finds the sleeve ends as the two corners of each sleeve opening", () => {
    close(landmarkAt(found.value, "hem-a", "right")?.at, { x: TEE.cx + TEE.sleeveTop.x, y: TEE.top + TEE.sleeveTop.y }, 6);
    close(landmarkAt(found.value, "hem-b", "right")?.at, { x: TEE.cx + TEE.sleeveBottom.x, y: TEE.top + TEE.sleeveBottom.y }, 6);
  });

  it("marks every landmark as found, not guessed", () => {
    expect(found.value.every((entry) => entry.origin === "found")).toBe(true);
  });
});

describe("findLandmarks with less to go on", () => {
  it("leaves the neck out, and says so, when the picture shows no neck opening", () => {
    const raster = teePicture({ garment: NAVY });
    fillPolygon(raster, [{ x: 270, y: 55 }, { x: 370, y: 55 }, { x: 370, y: 130 }, { x: 270, y: 130 }], NAVY);
    const found = findLandmarks(outlineOf(raster));
    expect(landmarkAt(found.value, "cf-neck", "centre")).toBeUndefined();
    expect(found.note).toMatch(/neck/i);
    expect(landmarkAt(found.value, "underarm", "right")).toBeDefined();
  });

  it("uses the model's guess where the contour gives nothing, and says it is a guess", () => {
    const raster = teePicture({ garment: NAVY });
    fillPolygon(raster, [{ x: 270, y: 55 }, { x: 370, y: 55 }, { x: 370, y: 130 }, { x: 270, y: 130 }], NAVY);
    const hint: LandmarkHint = { id: "cf-neck", side: "centre", at: { x: 320, y: 125 } };
    const found = findLandmarks(outlineOf(raster), [hint]);
    const neck = landmarkAt(found.value, "cf-neck", "centre");
    expect(neck?.origin).toBe("model-guess");
    expect(neck?.confidence).toBeLessThan(0.5);
  });

  it("falls back to a straight shoulder line when the sleeve has no bend", () => {
    const straight = { ...TEE, shoulderHalf: 150, shoulderDrop: 52 }; // shoulder on the line from hps to sleeve end
    const found = findLandmarks(outlineOf(teePicture({ garment: NAVY, shape: straight })));
    const shoulder = landmarkAt(found.value, "shoulder-point", "right");
    expect(shoulder).toBeDefined();
    expect(shoulder!.confidence).toBeLessThan(0.75);
  });

  it("raises confidence a little when the model's guess agrees with what was found", () => {
    const outline = outlineOf();
    const plain = findLandmarks(outline);
    const truth = teeGeometry().truth;
    const agreeing = findLandmarks(outline, [{ id: "hps", side: "right", at: truth.hps as Pt }]);
    expect(landmarkAt(agreeing.value, "hps", "right")!.confidence).toBeGreaterThanOrEqual(landmarkAt(plain.value, "hps", "right")!.confidence);
  });
});

describe("a photo with some perspective", () => {
  it("still finds the landmarks near where the warp put them", () => {
    const flat = teePicture({ garment: NAVY });
    const forward = (p: Pt): Pt => {
      const w = 1 + 0.0004 * p.y;
      return { x: 320 + (p.x - 320) / w, y: p.y / w + 10 };
    };
    // Inverse of the forward map, found by iteration.
    const inverse = (q: Pt): Pt => {
      let p = { x: q.x, y: q.y - 10 };
      for (let i = 0; i < 20; i += 1) {
        const f = forward(p);
        p = { x: p.x + (q.x - f.x), y: p.y + (q.y - f.y) };
      }
      return p;
    };
    const photo = warpRaster(flat, 640, 520, inverse);
    const found = findLandmarks(outlineOf(photo));
    const truth = teeGeometry().truth;
    for (const id of ["hps", "underarm", "side-hem"] as const) close(landmarkAt(found.value, id, "right")?.at, forward(truth[id] as Pt), 12);
  });
});

describe("applyHandleEdits", () => {
  it("moves a handle, marks it as moved by the person and makes it fully trusted", () => {
    const found = findLandmarks(outlineOf());
    const next = applyHandleEdits(found.value, [{ id: "underarm", side: "right", at: { x: 400, y: 190 } }]);
    const moved = landmarkAt(next, "underarm", "right");
    expect(moved).toMatchObject({ at: { x: 400, y: 190 }, origin: "moved-by-you", confidence: 1 });
    expect(landmarkAt(found.value, "underarm", "right")?.origin).toBe("found");
  });

  it("adds a handle that was missing", () => {
    const next = applyHandleEdits([], [{ id: "cf-neck", side: "centre", at: { x: 5, y: 6 } }]);
    expect(next).toHaveLength(1);
    expect(next[0].origin).toBe("moved-by-you");
  });
});
