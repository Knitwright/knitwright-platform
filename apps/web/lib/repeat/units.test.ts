import { describe, expect, it } from "vitest";
import { TILE_UNITS } from "./types";
import {
  effectiveDpi,
  fromTenths,
  isTileUnit,
  parseTileInput,
  TILE_MAX_TENTHS,
  TILE_MIN_TENTHS,
  tenthsPerUnit,
  tileInRange,
  tileRangeSentence,
  tileSentence,
  tileText,
  toTenths,
  unitWord,
} from "./units";

/**
 * A tile is typed in centimetres or inches and kept in tenths of a millimetre, like every other
 * measurement in the platform. The range is a labelled Knitwright default: the sentence beside the
 * field says so, so nobody reads it as a print house's word.
 */

describe("the units a tile is typed in", () => {
  it("knows its two units and nothing else", () => {
    expect(TILE_UNITS).toEqual(["cm", "in"]);
    expect(isTileUnit("cm")).toBe(true);
    expect(isTileUnit("in")).toBe(true);
    expect(isTileUnit("mm")).toBe(false);
    expect(isTileUnit(undefined)).toBe(false);
    expect(tenthsPerUnit("cm")).toBe(100);
    expect(tenthsPerUnit("in")).toBe(254);
    expect(unitWord("cm")).toBe("cm");
    expect(unitWord("in")).toBe("in");
  });

  it("reads centimetres and inches into tenths of a millimetre", () => {
    expect(toTenths(10, "cm")).toBe(1000);
    expect(toTenths(2.5, "cm")).toBe(250);
    expect(toTenths(1, "in")).toBe(254);
    expect(toTenths(4, "in")).toBe(1016);
  });

  it("writes tenths back out to two places, with no trailing zeros", () => {
    expect(fromTenths(1000, "cm")).toBe(10);
    expect(tileText(1000, "cm")).toBe("10");
    expect(tileText(1016, "in")).toBe("4");
    expect(tileText(1000, "in")).toBe("3.94");
    expect(tileSentence(1000, "cm")).toBe("10 cm");
    expect(tileSentence(1000, "in")).toBe("3.94 in");
  });

  it("takes a plain number and refuses anything else, in the unit being typed", () => {
    expect(parseTileInput(" 12.5 ", "cm")).toEqual({ ok: true, tenths: 1250 });
    expect(parseTileInput("4", "in")).toEqual({ ok: true, tenths: 1016 });
    for (const bad of ["", "ten", "12cm", "-4", "1.234", "1e3"]) {
      expect(parseTileInput(bad, "cm").ok, bad).toBe(false);
    }
  });

  it("refuses a tile outside the range and says the range in the unit being typed", () => {
    const small = parseTileInput("0.5", "cm");
    expect(small).toEqual({ ok: false, reason: "Enter a tile size from 1 to 200 cm." });
    const large = parseTileInput("300", "cm");
    expect(large.ok).toBe(false);
    const inches = parseTileInput("0.1", "in");
    expect(inches).toEqual({ ok: false, reason: "Enter a tile size from 0.39 to 78.74 in." });
  });

  it("holds the ends of the range itself", () => {
    expect(tileInRange(TILE_MIN_TENTHS)).toBe(true);
    expect(tileInRange(TILE_MAX_TENTHS)).toBe(true);
    expect(tileInRange(TILE_MIN_TENTHS - 1)).toBe(false);
    expect(tileInRange(TILE_MAX_TENTHS + 1)).toBe(false);
  });

  it("labels the range as Knitwright's own, not a print house's", () => {
    expect(tileRangeSentence("cm")).toBe("Tile 1 to 200 cm · Knitwright default, not reviewed by a print house");
    expect(tileRangeSentence("in")).toContain("not reviewed by a print house");
  });

  it("works out the resolution a picture lands at, and never divides by nothing", () => {
    // 1200 px across 10 cm is 1200 px over 3.937 in, which is 304.8 DPI.
    expect(effectiveDpi(1200, 1000)).toBe(304.8);
    expect(effectiveDpi(300, 1000)).toBe(76.2);
    expect(effectiveDpi(1200, 0)).toBe(0);
    expect(effectiveDpi(1200, -5)).toBe(0);
  });
});
