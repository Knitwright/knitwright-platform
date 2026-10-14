import { describe, expect, it } from "vitest";
import { blankRaster } from "../raster";
import { classify, crop, hexToRgb, interiorRect, nearest, ownColours, OUTSIDE, profile, rasterise, regionCount, type Frame } from "./grid";

const frame: Frame = { originX: 0, originY: 0, step: 1, width: 10, height: 10 };
const palette = [hexToRgb("#ffffff"), hexToRgb("#ff0000")];

describe("rasterise", () => {
  it("fills circles and polygons by pixel centre, later shapes over earlier, on a ground", () => {
    const labels = rasterise(
      {
        shapes: [
          { kind: "circle", centre: { x: 3, y: 3 }, radius: 2, fill: "#ff0000" },
          { kind: "polygon", fill: "#ffffff", points: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }] },
          { kind: "polygon", fill: "#ff0000", points: [{ x: 8, y: 8 }, { x: 9, y: 8 }] },
          { kind: "circle", centre: { x: 50, y: 50 }, radius: 2, fill: "#ff0000" },
        ],
      },
      frame,
      palette,
      0,
    );
    const at = (x: number, y: number) => labels.data[y * 10 + x];
    expect([at(3, 3), at(4, 3), at(5, 5), at(9, 9)]).toEqual([1, 1, 0, 0]);
    expect(at(0, 0)).toBe(0);
    expect(at(8, 8)).toBe(0);
    expect(at(1, 1)).toBe(0);
  });

  it("maps a shade it was not given to the nearest palette colour", () => {
    const labels = rasterise({ shapes: [{ kind: "circle", centre: { x: 5, y: 5 }, radius: 1, fill: "#f01010" }] }, frame, palette, 0);
    expect(labels.data[5 * 10 + 5]).toBe(1);
    expect(nearest(palette, [250, 250, 250])).toBe(0);
  });
});

describe("classify, profile, crop", () => {
  it("numbers garment pixels by nearest colour and leaves the rest outside", () => {
    const flat = blankRaster(4, 1, [255, 0, 0]);
    flat.data.set([255, 255, 255, 255], 4);
    flat.data.set([0, 0, 0, 0], 8);
    const labels = classify(flat, Uint8Array.from([255, 255, 255, 0]), palette);
    expect([...labels.data]).toEqual([1, 0, OUTSIDE, OUTSIDE]);
    expect(profile(labels, { x0: 0, y0: 0, x1: 4, y1: 1 }, 2)).toEqual([1, 1]);
    expect(crop(flat, { x0: 1, y0: 0, x1: 3, y1: 1 }).data.length).toBe(8);
  });
});

describe("interiorRect", () => {
  const maskOf = (w: number, h: number, hole: (x: number, y: number) => boolean) => Uint8Array.from({ length: w * h }, (_, at) => (hole(at % w, Math.floor(at / w)) ? 0 : 255));

  it("grows to the clear block and takes a margin off", () => {
    const rect = interiorRect(maskOf(40, 40, (x, y) => x < 5 || y < 10), 40, 40, 2, 10);
    expect(rect).toEqual({ x0: 7, y0: 12, x1: 38, y1: 38 });
  });
  it("is null for no garment, a seed that cannot grow, or a block under the least", () => {
    expect(interiorRect(new Uint8Array(100), 10, 10, 1, 4)).toBeNull();
    expect(interiorRect(maskOf(10, 10, () => false), 10, 10, 1, 20)).toBeNull();
  });
});

describe("regionCount", () => {
  it("counts patches of at least a size, not specks", () => {
    const labels = rasterise({ shapes: [{ kind: "circle", centre: { x: 2, y: 2 }, radius: 1.6, fill: "#ff0000" }, { kind: "circle", centre: { x: 7, y: 7 }, radius: 1.6, fill: "#ff0000" }, { kind: "polygon", fill: "#ff0000", points: [{ x: 5, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 1 }, { x: 5, y: 1 }] }] }, frame, palette, 0);
    const all = { x0: 0, y0: 0, x1: 10, y1: 10 };
    expect(regionCount(labels, all, 1)).toBe(5);
    expect(regionCount(labels, all, 4)).toBe(3);
  });
});

describe("ownColours", () => {
  const red = hexToRgb("#c8102e");
  const white = hexToRgb("#ffffff");
  const pink = hexToRgb("#e47c8e");
  const green = hexToRgb("#00aa44");

  it("drops a small colour that lies between two stronger ones, where they blend at an edge", () => {
    expect(ownColours([red, white, pink], [0.5, 0.45, 0.05])).toEqual([0, 1]);
  });
  it("keeps a colour of its own, and a blend-coloured one that holds a big share", () => {
    expect(ownColours([red, white, green], [0.5, 0.45, 0.05])).toEqual([0, 1, 2]);
    expect(ownColours([red, white, pink], [0.4, 0.3, 0.3])).toEqual([0, 1, 2]);
  });
  it("always keeps the first colour, the ground, whatever its share", () => {
    expect(ownColours([red, white], [0, 1])).toEqual([0, 1]);
  });
});
