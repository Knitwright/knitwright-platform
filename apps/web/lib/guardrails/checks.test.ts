import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { bleedCheck, bleedOutline } from "./bleed";
import { item, rectPanel } from "./fixtures";
import { gamutCheck, isInsideApproxGamut } from "./gamut";
import { minDpiCheck } from "./min-dpi";
import { safeZoneCheck } from "./safe-zone";
import { seamCrossCheck } from "./seam-cross";
import { DEFAULT_SETTINGS } from "./settings";
import { boundsOf, distanceBoxSegment, offsetOutline, pointInPolygon, segmentCross } from "./geometry";

const panel = rectPanel();

describe("seamCross", () => {
  it.each([
    ["inside the sewn edge", { x0: 100, y0: 100, x1: 200, y1: 200 }, 0],
    ["across the right seam", { x0: 450, y0: 100, x1: 520, y1: 200 }, 1],
    ["across a corner", { x0: 450, y0: 650, x1: 520, y1: 720 }, 1],
    ["covering the whole panel", { x0: -10, y0: -10, x1: 600, y1: 800 }, 0],
    ["fully off the panel", { x0: 600, y0: 100, x1: 700, y1: 200 }, 0],
  ])("%s", (_name, box, count) => {
    const found = seamCrossCheck(panel, [item({ id: "a", kind: "raster", box })]);
    expect(found).toHaveLength(count);
    if (count > 0) {
      expect(found[0]).toMatchObject({ code: "seam-cross", check: "seam_cross", severity: "warning", panel: "front", itemId: "a" });
      expect(found[0]?.locationMm).not.toBeNull();
      expect(found[0]?.message).toMatch(/seam/i);
    }
  });

  it("flags art across a mirrored seam line and says which kind", () => {
    const mirrored = rectPanel("front", [[[250, 0], [250, 700]]]);
    const found = seamCrossCheck(mirrored, [item({ id: "a", kind: "vector", box: { x0: 200, y0: 100, x1: 300, y1: 200 } })]);
    expect(found).toHaveLength(1);
    expect(found[0]?.message).toMatch(/centre seam|mirror/i);
    expect(found[0]?.locationMm?.x).toBeCloseTo(250);
  });

  it("falls back to the cut outline and says so when there is no sewn edge", () => {
    const bare = { ...panel, sewLine: null };
    const found = seamCrossCheck(bare, [item({ id: "a", kind: "raster", box: { x0: 450, y0: 100, x1: 520, y1: 200 } })]);
    expect(found[0]?.message).toMatch(/cut edge/);
  });

  it("ignores fills and items on other panels", () => {
    expect(seamCrossCheck(panel, [item({ id: "f", kind: "fill", box: { x0: 450, y0: 100, x1: 520, y1: 200 } })])).toEqual([]);
    expect(seamCrossCheck(panel, [item({ id: "o", kind: "raster", panelId: "back", box: { x0: 450, y0: 100, x1: 520, y1: 200 } })])).toEqual([]);
  });
});

describe("minDpi", () => {
  const raster = (widthPx: number, width: number) => item({ id: "r", kind: "raster", widthPx, box: { x0: 0, y0: 0, x1: width, y1: 100 } });
  it("passes at the minimum and above", () => {
    expect(minDpiCheck([raster(1500, 254)], DEFAULT_SETTINGS)).toEqual([]);
  });
  it("warns below the minimum and names the default as a default", () => {
    const [f] = minDpiCheck([raster(1000, 254)], DEFAULT_SETTINGS);
    expect(f).toMatchObject({ code: "min-dpi", check: "dpi", severity: "warning" });
    expect(f?.message).toContain("100 dpi");
    expect(f?.message).toContain("Knitwright default, not from your print house");
  });
  it("is a blocker below half the minimum", () => {
    expect(minDpiCheck([raster(500, 254)], DEFAULT_SETTINGS)[0]?.severity).toBe("blocker");
  });
  it("skips vectors, text and items with no pixel size", () => {
    const v = item({ id: "v", kind: "vector", box: { x0: 0, y0: 0, x1: 1000, y1: 10 } });
    const unknown = item({ id: "u", kind: "raster", box: { x0: 0, y0: 0, x1: 100, y1: 10 } });
    expect(minDpiCheck([v, unknown], DEFAULT_SETTINGS)).toEqual([]);
  });
  it("property: warns exactly when effective dpi is under the minimum", () => {
    fc.assert(
      fc.property(fc.integer({ min: 10, max: 8000 }), fc.integer({ min: 10, max: 2000 }), (px, mm) => {
        const dpi = px / (mm / 25.4);
        const found = minDpiCheck([raster(px, mm)], DEFAULT_SETTINGS);
        expect(found.length === 1).toBe(dpi < 150);
      }),
    );
  });
});

describe("bleed", () => {
  it("grows the outline outward by the bleed on every edge", () => {
    const grown = bleedOutline(panel.cutOutline, 10);
    expect(boundsOf(grown)).toEqual({ x0: -10, y0: -10, x1: 510, y1: 710 });
  });
  it("works whichever way the outline is wound", () => {
    expect(boundsOf(bleedOutline([...panel.cutOutline].reverse(), 10))).toEqual({ x0: -10, y0: -10, x1: 510, y1: 710 });
  });
  it("reports where a fill stops short of the bleed", () => {
    const found = bleedCheck(panel, [item({ id: "g", kind: "fill", box: { x0: 0, y0: 0, x1: 500, y1: 700 } })], DEFAULT_SETTINGS);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ code: "bleed-short", check: "bleed", severity: "warning" });
    expect(found[0]?.message).toContain("10 mm");
    expect(found[0]?.message).toContain("Knitwright default, not from your print house");
  });
  it("is quiet when the fill reaches the bleed", () => {
    expect(bleedCheck(panel, [item({ id: "g", kind: "fill", box: { x0: -10, y0: -10, x1: 510, y1: 710 } })], DEFAULT_SETTINGS)).toEqual([]);
  });
  it("says nothing when the panel has no fill", () => {
    expect(bleedCheck(panel, [item({ id: "c", kind: "raster", box: { x0: 0, y0: 0, x1: 10, y1: 10 } })], DEFAULT_SETTINGS)).toEqual([]);
  });
  it("a zero bleed needs no extension", () => {
    const zero = { ...DEFAULT_SETTINGS, bleedMm: { value: 0, source: "print-house" as const } };
    expect(bleedCheck(panel, [item({ id: "g", kind: "fill", box: { x0: 0, y0: 0, x1: 500, y1: 700 } })], zero)).toEqual([]);
  });
});

describe("safeZone", () => {
  const mark = (box: { x0: number; y0: number; x1: number; y1: number }, kind: "name" | "number" = "number") => item({ id: "m", kind, box });
  it("passes a mark with clear space", () => {
    expect(safeZoneCheck(panel, [mark({ x0: 150, y0: 200, x1: 350, y1: 400 })], DEFAULT_SETTINGS)).toEqual([]);
  });
  it("warns when a mark is closer to the seam than the clear space", () => {
    const [f] = safeZoneCheck(panel, [mark({ x0: 150, y0: 15, x1: 350, y1: 200 })], DEFAULT_SETTINGS);
    expect(f).toMatchObject({ code: "safe-zone", check: "safe_zone", severity: "warning" });
    expect(f?.message).toContain("Knitwright default, not from your print house");
  });
  it("is a blocker when the mark leaves the panel", () => {
    expect(safeZoneCheck(panel, [mark({ x0: 400, y0: 200, x1: 560, y1: 300 })], DEFAULT_SETTINGS)[0]?.severity).toBe("blocker");
  });
  it("only looks at names and numbers", () => {
    expect(safeZoneCheck(panel, [item({ id: "r", kind: "raster", box: { x0: 0, y0: 0, x1: 20, y1: 20 } })], DEFAULT_SETTINGS)).toEqual([]);
  });
  it("measures from the cut outline when there is no sewn edge", () => {
    const bare = { ...panel, sewLine: null };
    expect(safeZoneCheck(bare, [mark({ x0: 4, y0: 200, x1: 100, y1: 300 })], DEFAULT_SETTINGS)).toHaveLength(1);
  });
  it("property: a mark inside the panel is clear exactly when its distance to the sewn edge is at least the clear space", () => {
    fc.assert(
      fc.property(fc.integer({ min: 11, max: 300 }), fc.integer({ min: 11, max: 500 }), (x0, y0) => {
        const box = { x0, y0, x1: x0 + 100, y1: y0 + 100 };
        const inside = box.x1 < 490 && box.y1 < 690;
        fc.pre(inside);
        const margin = Math.min(x0 - 10, y0 - 10, 490 - box.x1, 690 - box.y1);
        expect(safeZoneCheck(panel, [mark(box)], DEFAULT_SETTINGS).length === 0).toBe(margin >= 10);
      }),
    );
  });
});

describe("gamut (approximate)", () => {
  it("keeps ordinary kit colours", () => {
    for (const hex of ["#000000", "#ffffff", "#1b2a49", "#808080", "#8b1a1a"]) expect(isInsideApproxGamut(hex)).toBe(true);
  });
  it("flags very saturated sRGB colours", () => {
    for (const hex of ["#00ff00", "#ff00ff", "#0000ff"]) expect(isInsideApproxGamut(hex)).toBe(false);
  });
  it("is always a warning, never a blocker, and says it is an estimate", () => {
    const found = gamutCheck([{ id: "g", label: "Neon", hex: "#00ff00" }, { id: "n", label: "Navy", hex: "#1b2a49" }]);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ code: "gamut-approx", check: "gamut", severity: "warning", panel: null });
    expect(found[0]?.message).toMatch(/rough estimate/i);
    expect(found[0]?.message).toMatch(/ICC profile/);
    expect(found[0]?.message).not.toMatch(/accurate|exact|will print as|guarantee/i);
  });
  it("names no colour twice and ignores a bad value", () => {
    expect(gamutCheck([{ id: "a", label: "A", hex: "not a colour" }])).toEqual([]);
  });
  it("property: greys are never flagged", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 255 }), (v) => {
        const h = v.toString(16).padStart(2, "0");
        expect(isInsideApproxGamut(`#${h}${h}${h}`)).toBe(true);
      }),
    );
  });
});

describe("geometry", () => {
  it("crosses, misses and measures", () => {
    expect(segmentCross([[0, 0], [10, 10]], [[0, 10], [10, 0]])).toEqual([5, 5]);
    expect(segmentCross([[0, 0], [1, 0]], [[0, 1], [1, 1]])).toBeNull();
    expect(segmentCross([[0, 0], [1, 1]], [[5, 0], [6, 1]])).toBeNull();
    expect(pointInPolygon([5, 5], [[0, 0], [10, 0], [10, 10], [0, 10]])).toBe(true);
    expect(distanceBoxSegment({ x0: 0, y0: 0, x1: 10, y1: 10 }, [[20, 0], [20, 10]])).toBe(10);
    expect(distanceBoxSegment({ x0: 0, y0: 0, x1: 10, y1: 10 }, [[5, -5], [5, 20]])).toBe(0);
    expect(offsetOutline([[0, 0], [1, 0], [2, 0]], 5)).toHaveLength(3);
  });
});

describe("edges and labels", () => {
  it("flags a mirror line that ends inside the box, and ignores one that misses it", () => {
    const short = rectPanel("front", [[[250, 120], [250, 140]]]);
    expect(seamCrossCheck(short, [item({ id: "a", kind: "raster", box: { x0: 200, y0: 100, x1: 300, y1: 200 } })])).toHaveLength(1);
    const far = rectPanel("front", [[[400, 300], [400, 600]]]);
    expect(seamCrossCheck(far, [item({ id: "a", kind: "raster", box: { x0: 200, y0: 100, x1: 300, y1: 200 } })])).toEqual([]);
  });
  it("names a print house setting as such", () => {
    const own = { ...DEFAULT_SETTINGS, minDpi: { value: 200, source: "print-house" as const } };
    const [f] = minDpiCheck([item({ id: "r", kind: "raster", widthPx: 1000, box: { x0: 0, y0: 0, x1: 254, y1: 10 } })], own);
    expect(f?.message).toContain("from your print house");
    expect(f?.message).not.toContain("Knitwright default");
  });
  it("offsets a straight run without spiking", () => {
    expect(offsetOutline([[0, 0], [1, 0], [2, 0]], 5).every(([, y]) => Math.abs(Math.abs(y) - 5) < 1e-9)).toBe(true);
  });
});
