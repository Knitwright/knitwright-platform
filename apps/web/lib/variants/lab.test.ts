import { describe, expect, it } from "vitest";
import { SWATCH_PATTERN } from "@/lib/garment";
import { toLab } from "@/lib/print/rules/colour";
import { hexFromLch, lchOf, shiftHue } from "./lab";

describe("colour in Lab", () => {
  it("reads lightness, chroma and hue, and gives the same colour back", () => {
    for (const hex of ["#1b2a49", "#d4af37", "#c8102e", "#ffffff", "#111111"]) {
      const [l, c, h] = lchOf(hex);
      expect(hexFromLch(l, c, h)).toBe(hex);
    }
  });

  it("keeps lightness while it turns the hue, and stays a screen colour", () => {
    const [l0] = lchOf("#c8102e");
    for (const degrees of [30, 120, 180, 240, 330]) {
      const turned = shiftHue("#c8102e", degrees);
      expect(turned).toMatch(SWATCH_PATTERN);
      expect(Math.abs(toLab(turned)[0] - l0)).toBeLessThan(6);
    }
  });

  it("pulls chroma back until the colour fits sRGB instead of clipping to a different hue", () => {
    const hex = hexFromLch(60, 140, 130);
    expect(hex).toMatch(SWATCH_PATTERN);
    const [, c] = lchOf(hex);
    expect(c).toBeLessThan(140);
  });
});
