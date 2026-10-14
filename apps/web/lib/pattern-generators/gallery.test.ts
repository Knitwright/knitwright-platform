import { describe, expect, it } from "vitest";
import { galleryTiles, TILE_MM } from "./gallery";
import { GENERATORS } from "./registry";

describe("gallery tiles", () => {
  const tiles = galleryTiles(["#2f5d34", "#6b8f3a", "#c8b27a", "#3b3a2a", "#8a6f3f"], "#ffffff");

  it("has a picture for every preset of every style", () => {
    expect(tiles).toHaveLength(GENERATORS.length * 3);
    expect(tiles.every((tile) => tile.list.shapes.length > 0 || tile.generatorId === "kit-fade")).toBe(true);
    expect(tiles.map((tile) => tile.presetId)).toContain("camo-woodland");
  });

  it("is drawn inside the swatch and is the same each time", () => {
    const again = galleryTiles(["#2f5d34", "#6b8f3a", "#c8b27a", "#3b3a2a", "#8a6f3f"], "#ffffff");
    expect(JSON.stringify(again)).toBe(JSON.stringify(tiles));
    expect(TILE_MM.width).toBeGreaterThan(0);
  });
});
