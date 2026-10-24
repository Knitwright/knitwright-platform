import { describe, expect, it } from "vitest";
import { CLUB_PALETTE } from "@/lib/kit-styles/presets";
import { COLOUR_FAMILIES, colourFamilyOf } from "./colour-family";

describe("the colour family of a swatch", () => {
  it.each([
    ["#1b2a49", "blue"],
    ["#6cabdd", "blue"],
    ["#c8102e", "red"],
    ["#7a1f2b", "red"],
    ["#00843d", "green"],
    ["#0b3d2e", "green"],
    ["#d4af37", "yellow"],
    ["#f6d330", "yellow"],
    ["#e86a10", "orange"],
    ["#5b2c83", "purple"],
    ["#111111", "black"],
    ["#ffffff", "white"],
    ["#8a8d91", "grey"],
  ])("puts %s in %s", (swatch, family) => {
    expect(colourFamilyOf(swatch)).toBe(family);
  });

  it("gives every club palette colour a listed family", () => {
    for (const { swatch } of CLUB_PALETTE) expect(COLOUR_FAMILIES).toContain(colourFamilyOf(swatch));
  });

  it("reads upper case and refuses what is not a swatch", () => {
    expect(colourFamilyOf("#C8102E")).toBe("red");
    expect(colourFamilyOf("red")).toBeNull();
    expect(colourFamilyOf("")).toBeNull();
  });
});
