import { describe, expect, it } from "vitest";
import { TEE_GRADED } from "./fixtures/patterns";
import { buildPanelLayout } from "./layout";
import { PRESET_VIEWS, SIZE_LABEL, atlasPlan, chooseViewer, presetCamera } from "./viewer";

const layout = buildPanelLayout(TEE_GRADED, "48");
const box = { size: [0.6, 0.8, 0.1] as const, centre: [0, 0, 0] as const };

describe("viewer helpers", () => {
  it("keeps the label that says this is not for fit or drape", () => {
    expect(SIZE_LABEL).toBe("A preview of shape and colour, not of fit or drape.");
  });

  it("falls back to the existing form when there is no model", () => {
    expect(chooseViewer(null)).toBe("form");
    expect(chooseViewer(undefined)).toBe("form");
    expect(chooseViewer({ asset: { version: "2.0" } })).toBe("model");
  });

  it("puts the camera on the right side for each preset, looking at the middle", () => {
    expect(PRESET_VIEWS).toEqual(["front", "back", "left", "right", "top"]);
    const at = (v: (typeof PRESET_VIEWS)[number]) => presetCamera(v, box, 32, 1.5);
    expect(at("front")[2]).toBeGreaterThan(0);
    expect(at("back")[2]).toBeLessThan(0);
    expect(at("left")[0]).toBeGreaterThan(0);
    expect(at("right")[0]).toBeLessThan(0);
    expect(at("top")[1]).toBeGreaterThan(0);
    expect(Math.abs(at("front")[2])).toBeCloseTo(Math.abs(at("back")[2]), 9);
  });

  it("moves back for a narrower frame", () => {
    expect(presetCamera("front", box, 32, 0.5)[2]).toBeGreaterThan(presetCamera("front", box, 32, 2)[2]);
  });

  it("plans where each panel picture is drawn in the 2048 picture, skipping panels with none", () => {
    const plan = atlasPlan(layout, ["front", "collar"]);
    expect(plan.size).toBe(2048);
    expect(plan.draws.map((d) => d.panelId)).toEqual(["front", "collar"]);
    const front = layout.panels.find((p) => p.id === "front")!;
    const d = plan.draws[0]!;
    expect([d.x, d.y, d.width, d.height]).toEqual([front.rect.u0 * 2048, front.rect.v0 * 2048, (front.rect.u1 - front.rect.u0) * 2048, (front.rect.v1 - front.rect.v0) * 2048]);
  });
});
