import { describe, expect, it } from "vitest";
import { TEE_GRADED } from "./fixtures/patterns";
import { TEXTURE_SIZE, buildPanelLayout, panelGroupOf } from "./layout";

describe("buildPanelLayout", () => {
  const layout = buildPanelLayout(TEE_GRADED, "48");

  it("has one panel for each thing the print files print", () => {
    expect(layout.panels.map((p) => p.id)).toEqual(["front", "back", "sleeve-left", "sleeve-right", "collar"]);
    expect(layout.textureSize).toBe(TEXTURE_SIZE);
    expect(TEXTURE_SIZE).toBe(2048);
  });

  it("keeps every rectangle inside the picture and apart from the others", () => {
    for (const p of layout.panels) {
      expect(p.rect.u0).toBeGreaterThanOrEqual(0);
      expect(p.rect.v0).toBeGreaterThanOrEqual(0);
      expect(p.rect.u1).toBeLessThanOrEqual(1);
      expect(p.rect.v1).toBeLessThanOrEqual(1);
    }
    for (const a of layout.panels) {
      for (const b of layout.panels) {
        if (a.id >= b.id) continue;
        const apart = a.rect.u1 <= b.rect.u0 || b.rect.u1 <= a.rect.u0 || a.rect.v1 <= b.rect.v0 || b.rect.v1 <= a.rect.v0;
        expect(apart, `${a.id} and ${b.id}`).toBe(true);
      }
    }
  });

  it("draws every panel at one scale, so the rectangle is the panel in millimetres", () => {
    for (const p of layout.panels) {
      expect((p.rect.u1 - p.rect.u0) * TEXTURE_SIZE).toBeCloseTo(p.widthMm * layout.pxPerMm, 6);
      expect((p.rect.v1 - p.rect.v0) * TEXTURE_SIZE).toBeCloseTo(p.heightMm * layout.pxPerMm, 6);
    }
  });

  it("places each outline from the lower left corner of its box", () => {
    for (const p of layout.panels) {
      const xs = p.outline.map((pt) => pt[0]);
      const ys = p.outline.map((pt) => pt[1]);
      expect(Math.min(...xs)).toBeCloseTo(0, 9);
      expect(Math.min(...ys)).toBeCloseTo(0, 9);
      expect(Math.max(...xs)).toBeCloseTo(p.widthMm, 9);
      expect(Math.max(...ys)).toBeCloseTo(p.heightMm, 9);
    }
  });

  it("is the same twice and does not change its input", () => {
    const before = JSON.stringify(TEE_GRADED);
    expect(buildPanelLayout(TEE_GRADED, "48")).toEqual(layout);
    expect(JSON.stringify(TEE_GRADED)).toBe(before);
  });

  it("opens a piece cut on the fold: the front is taller than its half (the fold line runs along x)", () => {
    const half = TEE_GRADED.piecesBySize["48"]?.find((p) => p.id === "front")?.cutOutline.map((pt) => pt[1]) ?? [];
    const front = layout.panels.find((p) => p.id === "front");
    expect(front?.heightMm).toBeGreaterThan(Math.max(...half) - Math.min(...half));
  });

  it("lets the caller fix the scale, and refuses a scale that does not fit", () => {
    expect(buildPanelLayout(TEE_GRADED, "48", { pxPerMm: 0.5 }).pxPerMm).toBe(0.5);
    expect(() => buildPanelLayout(TEE_GRADED, "48", { pxPerMm: 50 })).toThrow(/fit/);
  });

  it("refuses an unknown size and a size with no printable piece", () => {
    expect(() => buildPanelLayout(TEE_GRADED, "99")).toThrow(/size/);
    expect(() => buildPanelLayout(TEE_GRADED, "48", { roles: {} })).toThrow(/no piece/);
  });

  it("groups panels by material", () => {
    expect(panelGroupOf("front")).toBe("body");
    expect(panelGroupOf("back")).toBe("body");
    expect(panelGroupOf("sleeve-left")).toBe("sleeve");
    expect(panelGroupOf("sleeve-right")).toBe("sleeve");
    expect(panelGroupOf("collar")).toBe("collar");
  });
});
