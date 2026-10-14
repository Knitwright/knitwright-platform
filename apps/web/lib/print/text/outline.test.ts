import { describe, expect, it } from "vitest";
import { boundsOf } from "../geometry/polygon";
import { readFileSync } from "node:fs";
import { OUTLINE_FONT_FILE, bundledFont, outlineText, textWidthMm } from "./outline";
import { readTrueType } from "./truetype";

describe("outlineText", () => {
  it("draws a capital letter at the height asked for", () => {
    const out = outlineText("H", 100);
    const box = boundsOf(out.rings.flat());
    expect(box.minY).toBeCloseTo(0, 1);
    expect(box.maxY).toBeCloseTo(100, 0);
    expect(out.heightMm).toBe(100);
    expect(out.missing).toEqual([]);
  });

  it("is wider for longer text and scales with height", () => {
    expect(textWidthMm("RIVERA", 50)).toBeGreaterThan(textWidthMm("RIV", 50));
    expect(textWidthMm("RIVERA", 100)).toBeCloseTo(2 * textWidthMm("RIVERA", 50), 1);
  });

  it("gives counters to letters that have them (an O has an inner ring)", () => {
    expect(outlineText("O", 50).rings).toHaveLength(2);
    expect(outlineText("10", 50).rings.length).toBeGreaterThanOrEqual(3);
  });

  it("reads accented capitals from composite glyphs", () => {
    const plain = outlineText("N", 50).rings.length;
    expect(outlineText("Ñ", 50).rings.length).toBeGreaterThan(plain);
  });

  it("leaves out control characters, names what the font lacks, and gives a space its width", () => {
    expect(outlineText("A\u0007B", 40).rings).toEqual(outlineText("AB", 40).rings);
    expect(outlineText("日", 40).missing).toEqual(["日"]);
    expect(textWidthMm("A B", 40)).toBeGreaterThan(textWidthMm("AB", 40));
    expect(outlineText("", 40).rings).toEqual([]);
  });

  it("is the same on every run", () => {
    expect(JSON.stringify(outlineText("Cañón 07", 33))).toBe(JSON.stringify(outlineText("Cañón 07", 33)));
  });

  it("refuses a height of nothing and a file that is not a font", () => {
    expect(() => outlineText("A", 0)).toThrow(RangeError);
    expect(() => readTrueType(new Uint8Array(40))).toThrow("could not be read");
    expect(() => readTrueType(new Uint8Array(3))).toThrow("could not be read");
    const real = readFileSync(OUTLINE_FONT_FILE);
    expect(() => readTrueType(new Uint8Array(real.subarray(0, 4000)))).toThrow("could not be read");
    expect(bundledFont().unitsPerEm).toBeGreaterThan(0);
  });
});
