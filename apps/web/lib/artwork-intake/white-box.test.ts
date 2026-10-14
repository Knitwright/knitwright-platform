import { describe, expect, it } from "vitest";
import { hasWhiteBox, removeWhiteBox, type RgbaImage } from "./white-box";

const WHITE = [255, 255, 255, 255];
const RED = [200, 0, 0, 255];

const make = (width: number, height: number, paint: (x: number, y: number) => number[]): RgbaImage => {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) data.set(paint(x, y), (y * width + x) * 4);
  return { data, width, height };
};

const alphaAt = (image: RgbaImage, x: number, y: number) => image.data[(y * image.width + x) * 4 + 3];

describe("hasWhiteBox", () => {
  it("finds a logo on a white box", () => {
    expect(hasWhiteBox(make(10, 10, (x, y) => (x > 3 && x < 7 && y > 3 && y < 7 ? RED : WHITE)))).toBe(true);
  });

  it("does not take a plain white picture, a coloured border, or a see-through one for a box", () => {
    expect(hasWhiteBox(make(10, 10, () => WHITE))).toBe(false);
    expect(hasWhiteBox(make(10, 10, (x) => (x === 0 ? RED : WHITE)))).toBe(false);
    expect(hasWhiteBox(make(10, 10, (x, y) => (x === 5 && y === 5 ? RED : [255, 255, 255, 0])))).toBe(false);
    expect(hasWhiteBox(make(2, 2, () => RED))).toBe(false);
  });
});

describe("removeWhiteBox", () => {
  const badge = make(12, 12, (x, y) => {
    const inside = x >= 3 && x <= 8 && y >= 3 && y <= 8;
    const eye = x >= 5 && x <= 6 && y >= 5 && y <= 6;
    return inside && !eye ? RED : WHITE;
  });

  it("clears the white that touches the border and keeps the white inside the artwork", () => {
    const cleared = removeWhiteBox(badge);
    expect(alphaAt(cleared, 0, 0)).toBe(0);
    expect(alphaAt(cleared, 11, 11)).toBe(0);
    expect(alphaAt(cleared, 4, 4)).toBe(255);
    expect(alphaAt(cleared, 5, 5)).toBe(255);
  });

  it("returns new pixels and leaves the original alone", () => {
    const cleared = removeWhiteBox(badge);
    expect(cleared.data).not.toBe(badge.data);
    expect(alphaAt(badge, 0, 0)).toBe(255);
  });

  it("makes a picture with no white border unchanged", () => {
    const solid = make(4, 4, () => RED);
    expect([...removeWhiteBox(solid).data]).toEqual([...solid.data]);
  });
});
