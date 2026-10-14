import { describe, expect, it } from "vitest";
import type { Pixels } from "./pixels";
import { hasWhiteBackground, removeWhiteBackground } from "./white";

/** A picture of `size` x `size` white pixels with a red disc in the middle and a white dot inside it. */
const logo = (size = 20, channels: 3 | 4 = 3): Pixels => {
  const data = new Uint8Array(size * size * channels).fill(255);
  const centre = size / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const distance = Math.hypot(x - centre + 0.5, y - centre + 0.5);
      if (distance < size / 3 && distance > size / 10) data.set([200, 16, 46], (y * size + x) * channels);
    }
  }
  return { data, width: size, height: size, channels };
};

describe("hasWhiteBackground", () => {
  it("is true for art on a white box, with or without an alpha channel", () => {
    expect(hasWhiteBackground(logo())).toBe(true);
    expect(hasWhiteBackground(logo(20, 4))).toBe(true);
  });

  it("is false for a see-through border, a coloured border, a blank page and a tiny picture", () => {
    const seeThrough = logo(20, 4);
    for (let x = 0; x < 20; x += 1) seeThrough.data[x * 4 + 3] = 0;
    for (let i = 0; i < 20 * 20; i += 1) seeThrough.data[i * 4 + 3] = 0;
    expect(hasWhiteBackground(seeThrough)).toBe(false);
    expect(hasWhiteBackground({ data: new Uint8Array(20 * 20 * 3).fill(30), width: 20, height: 20, channels: 3 })).toBe(false);
    expect(hasWhiteBackground({ data: new Uint8Array(20 * 20 * 3).fill(255), width: 20, height: 20, channels: 3 })).toBe(false);
    expect(hasWhiteBackground({ data: new Uint8Array(12).fill(255), width: 2, height: 2, channels: 3 })).toBe(false);
  });
});

describe("removeWhiteBackground", () => {
  it("makes the outside white see-through, keeps the white inside the art, and does not change the input", () => {
    const input = logo();
    const before = Uint8Array.from(input.data);
    const { pixels, removed } = removeWhiteBackground(input);
    expect(input.data).toEqual(before);
    expect(pixels.channels).toBe(4);
    expect(pixels.data[3]).toBe(0);
    const middle = (10 * 20 + 10) * 4;
    expect(pixels.data[middle + 3]).toBe(255);
    expect(removed).toBeGreaterThan(200);
    // The red ring stays opaque.
    const ring = (10 * 20 + 5) * 4;
    expect([pixels.data[ring], pixels.data[ring + 3]]).toEqual([200, 255]);
  });

  it("keeps a see-through input's own alpha where it does not remove", () => {
    const { pixels } = removeWhiteBackground(logo(20, 4));
    expect(pixels.data[(10 * 20 + 5) * 4 + 3]).toBe(255);
  });
});
