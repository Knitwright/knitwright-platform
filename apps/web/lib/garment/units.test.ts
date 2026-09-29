import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  MEASUREMENT_MAX_TENTHS_MM,
  cmToTenthsMm,
  formatCm,
  tenthsMmToCm,
} from "./units";

describe("units", () => {
  it("stores 52.5 cm as 5250 tenths of a millimetre", () => {
    expect(cmToTenthsMm(52.5)).toBe(5250);
  });

  it("shows 5250 tenths of a millimetre as 52.5 cm", () => {
    expect(tenthsMmToCm(5250)).toBe(52.5);
  });

  it("rounds a centimetre value to the nearest tenth of a millimetre", () => {
    expect(cmToTenthsMm(52.504)).toBe(5250);
    expect(cmToTenthsMm(52.506)).toBe(5251);
  });

  it("refuses a centimetre value that is not a finite number", () => {
    expect(cmToTenthsMm(Number.NaN)).toBeNull();
    expect(cmToTenthsMm(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("formats to one decimal place, rounding to the nearest", () => {
    expect(formatCm(5250)).toBe("52.5");
    expect(formatCm(5254)).toBe("52.5");
    expect(formatCm(5256)).toBe("52.6");
    expect(formatCm(5000)).toBe("50.0");
    expect(formatCm(4)).toBe("0.0");
  });

  it("gets back the same stored value after a trip through centimetres", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: MEASUREMENT_MAX_TENTHS_MM }), (stored) => {
        expect(cmToTenthsMm(tenthsMmToCm(stored))).toBe(stored);
      }),
    );
  });
});
