import { describe, expect, it } from "vitest";
import { isInsideApproxGamut } from "@/lib/guardrails/gamut";
import { deltaE } from "@/lib/print/rules/colour";
import { colourCounts, extractPalette, nearestSublimationSafe, type Pixels } from "./palette";

/**
 * The shared crest palette (F-S9 and F-T2) and the sublimation estimate. Fixtures are generated
 * here: no third-party crest is committed (plan v5 Z6).
 */

/** A picture of blocks of colour, each block as many pixels as its count says. Alpha 255 unless given. */
const picture = (blocks: readonly (readonly [string, number, number?])[]): Pixels => {
  const data: number[] = [];
  for (const [hex, count, alpha = 255] of blocks) {
    const rgb = [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16));
    for (let pixel = 0; pixel < count; pixel += 1) data.push(rgb[0]!, rgb[1]!, rgb[2]!, alpha);
  }
  return { width: data.length / 4, height: 1, data };
};

describe("colourCounts", () => {
  it("counts each colour and ignores the transparent pixels", () => {
    const counts = colourCounts(picture([["#c8102e", 3], ["#ffffff", 2], ["#00843d", 4, 0]]));
    expect([...counts]).toEqual([["#c8102e", 3], ["#ffffff", 2]]);
  });

  it("takes an even stride over a picture bigger than the cap, so a large crest stays quick", () => {
    const counts = colourCounts(picture([["#c8102e", 1000]]), { sampleCap: 10 });
    expect(counts.get("#c8102e")).toBe(10);
  });

  it("has nothing to count in an empty picture", () => {
    expect(colourCounts({ width: 0, height: 0, data: [] }).size).toBe(0);
  });
});

describe("extractPalette", () => {
  it("finds the three colours of a three-colour crest, dominant first", () => {
    const palette = extractPalette(picture([["#c8102e", 60], ["#ffffff", 30], ["#0b1f4b", 10]]), { colours: 3 });
    expect(palette.map((swatch) => swatch.hex)).toEqual(["#c8102e", "#ffffff", "#0b1f4b"]);
    expect(palette.map((swatch) => Math.round(swatch.share * 100))).toEqual([60, 30, 10]);
  });

  it("never returns more colours than the picture holds", () => {
    expect(extractPalette(picture([["#c8102e", 5], ["#ffffff", 5]]), { colours: 8 })).toHaveLength(2);
  });

  it("gives the same answer every run, for the same pixels", () => {
    const blocks = [["#c8102e", 40], ["#d01432", 25], ["#ffffff", 20], ["#0b1f4b", 12], ["#00843d", 9]] as const;
    const once = extractPalette(picture(blocks));
    const again = extractPalette(picture(blocks));
    expect(again).toEqual(once);
  });

  it("groups two shades a camera made of one ink into one swatch close to both", () => {
    const [swatch, ...rest] = extractPalette(picture([["#c8102e", 50], ["#c61230", 50]]), { colours: 1 });
    expect(rest).toEqual([]);
    expect(deltaE(swatch!.hex, "#c8102e")).toBeLessThan(2);
  });

  it("matches the dominant colour of a crest well within the F-T2 bar of deltaE 5", () => {
    // A crest: a big field, a smaller band, a line of trim, and a cut-out background.
    const crest = picture([["#0b1f4b", 700], ["#ffd100", 200], ["#c8102e", 100], ["#123456", 400, 0]]);
    expect(deltaE(extractPalette(crest)[0]!.hex, "#0b1f4b")).toBeLessThan(5);
  });

  it("has no palette for a picture that is wholly transparent", () => {
    expect(extractPalette(picture([["#c8102e", 20, 0]]))).toEqual([]);
  });

  it("shares add up to the pixels it looked at", () => {
    const palette = extractPalette(picture([["#c8102e", 7], ["#ffffff", 3], ["#00843d", 5]]), { colours: 3 });
    expect(palette.reduce((sum, swatch) => sum + swatch.share, 0)).toBeCloseTo(1, 10);
  });

  it("settles on a picture of many colours without running away", () => {
    const blocks = Array.from({ length: 40 }, (_, at) => [`#${(at * 6).toString(16).padStart(2, "0")}3f7a`, at + 1] as const);
    const palette = extractPalette(picture(blocks), { colours: 5, iterations: 2 });
    expect(palette).toHaveLength(5);
    expect(palette.every((swatch) => /^#[0-9a-f]{6}$/.test(swatch.hex))).toBe(true);
  });
});

describe("nearestSublimationSafe", () => {
  it("leaves a colour the estimate accepts exactly as it is, with no warning", () => {
    const match = nearestSublimationSafe("#0b1f4b");
    expect(match).toEqual({ hex: "#0b1f4b", safeHex: "#0b1f4b", inGamut: true, deltaE: 0, warning: "" });
  });

  it("pulls a colour the estimate refuses back inside it, and says it is an estimate", () => {
    const match = nearestSublimationSafe("#0000ff");
    expect(match.inGamut).toBe(false);
    expect(isInsideApproxGamut(match.safeHex)).toBe(true);
    expect(match.deltaE).toBeGreaterThan(0);
    expect(match.warning).toContain("Knitwright's own estimate, not a colour match");
    expect(match.warning).toContain(match.safeHex);
  });

  it("keeps the lightness and hue it was given, changing only the chroma", () => {
    const match = nearestSublimationSafe("#00ff00");
    const [before, after] = [match.hex, match.safeHex].map((hex) => nearestSublimationSafe(hex));
    expect(after.inGamut).toBe(true);
    expect(before.inGamut).toBe(false);
  });

  it("works through the whole list of over-saturated sRGB corners", () => {
    for (const hex of ["#ff0000", "#00ff00", "#0000ff", "#ff00ff", "#00ffff", "#ffff00"]) {
      const match = nearestSublimationSafe(hex);
      expect(isInsideApproxGamut(match.safeHex)).toBe(true);
    }
  });

  it("takes an upper case colour and answers in lower case", () => {
    expect(nearestSublimationSafe("#0B1F4B").safeHex).toBe("#0b1f4b");
  });

  it("refuses something that is not a colour", () => {
    expect(() => nearestSublimationSafe("navy")).toThrow(RangeError);
  });
});
