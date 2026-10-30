import { describe, expect, it } from "vitest";
import { draft, layer } from "./fixtures/drafts";
import { addLayer, changeLayer, clampToTile, crossingBounds, layerBox, newLayer, removeLayer, reorderLayer, setBackground, setTileSide, withinTile } from "./layers";

/** The tile's layers and its bounds. Every rule the panel's buttons follow is here, and tested here. */

const tile = { widthTenths: 1000, heightTenths: 1000 };

describe("a layer's box inside the tile", () => {
  it("is half its size either side of its centre", () => {
    expect(layerBox(layer({ xTenths: 500, yTenths: 400, widthTenths: 200, heightTenths: 100 }))).toEqual({
      leftTenths: 400,
      topTenths: 350,
      rightTenths: 600,
      bottomTenths: 450,
    });
  });

  it("knows when it is inside the tile and when it crosses an edge", () => {
    expect(withinTile(layer({ xTenths: 500, yTenths: 500, widthTenths: 1000, heightTenths: 1000 }), tile)).toBe(true);
    expect(withinTile(layer({ xTenths: 0, yTenths: 500 }), tile)).toBe(false);
    expect(withinTile(layer({ xTenths: 1000, yTenths: 500 }), tile)).toBe(false);
    expect(withinTile(layer({ xTenths: 500, yTenths: 1000 }), tile)).toBe(false);
  });

  it("moves a layer the shortest way back inside, and centres one larger than the tile", () => {
    expect(clampToTile(layer({ xTenths: 0, yTenths: 500 }), tile)).toMatchObject({ xTenths: 250, yTenths: 500 });
    expect(clampToTile(layer({ xTenths: 1200, yTenths: 1200 }), tile)).toMatchObject({ xTenths: 750, yTenths: 750 });
    expect(clampToTile(layer({ xTenths: 10, widthTenths: 2000, heightTenths: 2000 }), tile)).toMatchObject({ xTenths: 500, yTenths: 500 });
    // A layer already inside is left exactly where it is.
    const inside = layer({ xTenths: 400, yTenths: 600 });
    expect(clampToTile(inside, tile)).toEqual(inside);
  });

  it("lists the layers that cross the bounds, in the order they are listed", () => {
    const over = draft({ layers: [layer({ id: "a" }), layer({ id: "b", xTenths: 0 }), layer({ id: "c", yTenths: 0 })] });
    expect(crossingBounds(over)).toEqual(["b", "c"]);
    expect(crossingBounds(draft())).toEqual([]);
  });
});

describe("the layer list", () => {
  it("adds a layer on top of the ones already there", () => {
    const added = addLayer(draft(), layer({ id: "l2" }));
    expect(added.layers.map((entry) => entry.id)).toEqual(["l1", "l2"]);
  });

  it("removes a layer, and leaves the list alone for an id that is not there", () => {
    const base = draft({ layers: [layer({ id: "a" }), layer({ id: "b" })] });
    expect(removeLayer(base, "a").layers.map((entry) => entry.id)).toEqual(["b"]);
    expect(removeLayer(base, "zz").layers).toHaveLength(2);
  });

  it("changes one layer and never lets a change rewrite its id", () => {
    const base = draft({ layers: [layer({ id: "a" }), layer({ id: "b" })] });
    const changed = changeLayer(base, "a", { colour: "#ff0000", id: "stolen" });
    expect(changed.layers[0]).toMatchObject({ id: "a", colour: "#ff0000" });
    expect(changed.layers[1]).toMatchObject({ id: "b", colour: "#1b2a49" });
    expect(changeLayer(base, "zz", { colour: "#ff0000" }).layers[0]?.colour).toBe("#1b2a49");
  });

  it("moves a layer one place forward or back, and stops at either end", () => {
    const base = draft({ layers: [layer({ id: "a" }), layer({ id: "b" }), layer({ id: "c" })] });
    expect(reorderLayer(base, "a", 1).layers.map((entry) => entry.id)).toEqual(["b", "a", "c"]);
    expect(reorderLayer(base, "c", -1).layers.map((entry) => entry.id)).toEqual(["a", "c", "b"]);
    expect(reorderLayer(base, "a", -1)).toBe(base);
    expect(reorderLayer(base, "c", 1)).toBe(base);
    expect(reorderLayer(base, "zz", 1)).toBe(base);
  });
});

describe("the background and the tile size", () => {
  it("takes a colour as #rrggbb, in any case, and refuses anything half-typed", () => {
    expect(setBackground(draft(), "#FF0055").background).toBe("#ff0055");
    expect(setBackground(draft(), " #abcdef ").background).toBe("#abcdef");
    expect(setBackground(draft(), "#abc").background).toBe("#ffffff");
    expect(setBackground(draft(), "red").background).toBe("#ffffff");
  });

  it("takes a tile side inside the range and refuses one outside it", () => {
    expect(setTileSide(draft(), "width", 2000).tile).toEqual({ widthTenths: 2000, heightTenths: 1000 });
    expect(setTileSide(draft(), "height", 2000).tile).toEqual({ widthTenths: 1000, heightTenths: 2000 });
    expect(setTileSide(draft(), "width", 10).tile.widthTenths).toBe(1000);
    expect(setTileSide(draft(), "width", 999_999).tile.widthTenths).toBe(1000);
  });
});

describe("a new layer", () => {
  it("starts half the tile wide, in the middle of it, upright", () => {
    const made = newLayer(draft(), { id: "n1", label: "Crest", artworkId: "11111111-1111-4111-8111-111111111111" });
    expect(made).toMatchObject({ id: "n1", label: "Crest", shape: null, xTenths: 500, yTenths: 500, widthTenths: 500, heightTenths: 500, rotationDeg: 0, sourcePx: null });
    expect(withinTile(made, draft().tile)).toBe(true);
  });

  it("can be a drawn shape with its own colour and no picture", () => {
    const shape = newLayer(draft(), { id: "n2", label: "Hoop", shape: "stripe", colour: "#00ff00" });
    expect(shape).toMatchObject({ artworkId: null, shape: "stripe", colour: "#00ff00" });
  });

  it("keeps the picture's own pixels, so the resolution check has something to read", () => {
    const picture = newLayer(draft(), { id: "n3", label: "Camo", artworkId: null, sourcePx: { width: 800, height: 600 } });
    expect(picture.sourcePx).toEqual({ width: 800, height: 600 });
  });
});
