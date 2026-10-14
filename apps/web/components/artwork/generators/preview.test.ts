import { describe, expect, it } from "vitest";
import { presetsOf } from "@/lib/pattern-generators/presets";
import { ALL_GENERATORS, findGenerator } from "@/lib/pattern-generators/registry";
import { previewOf, svgShapes } from "./preview";

describe("gallery previews", () => {
  it("draws every preset of every generator", () => {
    for (const generator of ALL_GENERATORS) {
      for (const preset of presetsOf(generator.id)) expect(previewOf(generator, preset).shapes.length, preset.id).toBeGreaterThan(0);
    }
  });

  it("draws the old fade with no preset and uses the colours given", () => {
    const fade = findGenerator("kit-fade");
    const drawn = fade && previewOf(fade, undefined, ["#ff0000", "#00ff00"]);
    expect(drawn?.shapes.length).toBeGreaterThan(0);
    expect(drawn?.shapes.some((shape) => shape.fill === "#ff0000" || shape.fill === "#00ff00")).toBe(true);
  });

  it("turns circles and polygons into svg parts, and carries a note", () => {
    const shapes = svgShapes({ shapes: [{ kind: "circle", centre: { x: 1, y: 2 }, radius: 3, fill: "#000000" }, { kind: "polygon", points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], fill: "#ffffff" }] });
    expect(shapes).toEqual([
      { key: "s0", tag: "circle", fill: "#000000", cx: 1, cy: 2, r: 3 },
      { key: "s1", tag: "polygon", fill: "#ffffff", points: "0,0 1,0 1,1" },
    ]);
    const halftone = findGenerator("halftone");
    expect(halftone && previewOf(halftone, undefined).note).toBeUndefined();
  });
});
