import { describe, expect, it } from "vitest";
import { FIXTURE_STACK } from "./fixtures/stack";
import { KIND_LABELS, layerLabel, viewBoxOf } from "./labels";

describe("plain names for layers", () => {
  it("names every kind and prefers the name a person gave", () => {
    expect(layerLabel(FIXTURE_STACK.layers[0]!)).toBe("Base colour");
    expect(FIXTURE_STACK.layers.map(layerLabel)).toEqual(["Base colour", "Pattern", "Picture fill", "Club crest", 'Text "ACME BUILDERS"', "Name and number (back-number)"]);
    expect(Object.keys(KIND_LABELS)).toHaveLength(6);
  });
});

describe("the window on a panel", () => {
  it("is the panel with a margin round it, and the same for the canvas and the outline under it", () => {
    const view = viewBoxOf({ centre: { x: 10, y: 20 }, size: { w: 100, h: 200 } }, 30);
    expect(view).toEqual({ x: -70, y: -110, w: 160, h: 260 });
  });
});
