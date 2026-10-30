import { describe, expect, it } from "vitest";
import { draft, layer } from "./fixtures/drafts";
import { layerDraws, repeatPreview, tileDraws } from "./preview";

/**
 * What the panel draws. A tile that joins at the edges brings a layer back on the opposite side,
 * which is what makes a repeat seamless; with joining off the tile's bounds are a hard edge.
 */

describe("one tile's worth of draws", () => {
  it("draws a layer inside the tile once, by its top-left corner", () => {
    const draws = layerDraws(layer(), draft());
    expect(draws).toHaveLength(1);
    expect(draws[0]).toMatchObject({ layerId: "l1", copy: 0, leftTenths: 250, topTenths: 250, widthTenths: 500, heightTenths: 500, label: "Club stripe" });
  });

  it("brings a layer over the left edge back on the right", () => {
    const draws = layerDraws(layer({ xTenths: 0 }), draft());
    expect(draws.map((entry) => entry.leftTenths)).toEqual([-250, 750]);
    expect(draws[1]?.copy).toBe(1);
  });

  it("brings a layer over the right edge back on the left, and over the bottom back to the top", () => {
    expect(layerDraws(layer({ xTenths: 1000 }), draft()).map((entry) => entry.leftTenths)).toEqual([750, -250]);
    expect(layerDraws(layer({ yTenths: 1000 }), draft()).map((entry) => entry.topTenths)).toEqual([750, -250]);
  });

  it("draws a layer in a corner four times, so every corner of the tile matches", () => {
    const corner = layerDraws(layer({ xTenths: 0, yTenths: 0 }), draft());
    expect(corner).toHaveLength(4);
    expect(corner.map((entry) => entry.copy)).toEqual([0, 1, 2, 3]);
    expect(corner[3]).toMatchObject({ leftTenths: 750, topTenths: 750 });
  });

  it("draws nothing extra where the tile does not join at the edges", () => {
    expect(layerDraws(layer({ xTenths: 0, yTenths: 0 }), draft({ wrap: false }))).toHaveLength(1);
  });

  it("keeps the layers in order, bottom first, and carries each layer's own look", () => {
    const draws = tileDraws(draft({ layers: [layer({ id: "a", colour: "#000000" }), layer({ id: "b", artworkId: null, shape: "circle", rotationDeg: 45 })] }));
    expect(draws.map((entry) => entry.layerId)).toEqual(["a", "b"]);
    expect(draws[0]).toMatchObject({ colour: "#000000", shape: null });
    expect(draws[1]).toMatchObject({ shape: "circle", rotationDeg: 45, artworkId: null });
  });
});

describe("the whole preview", () => {
  it("carries the background, the tile, one tile's draws and where the tiles go", () => {
    const area = { widthTenths: 2000, heightTenths: 2000 };
    const view = repeatPreview(draft({ background: "#eeeeee", style: "brick" }), area);
    expect(view.background).toBe("#eeeeee");
    expect(view.tile).toEqual({ widthTenths: 1000, heightTenths: 1000 });
    expect(view.area).toEqual(area);
    expect(view.draws).toHaveLength(1);
    expect(view.tiles.some((entry) => entry.row === -1)).toBe(true);
  });
});
