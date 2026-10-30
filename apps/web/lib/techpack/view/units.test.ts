import { describe, expect, it } from "vitest";
import { LENGTH_UNITS, UNIT_LABELS, UNIT_NAMES, formatLength, formatLengthWithUnit, formatSigned } from "./units";

/** Spec F-S6: the tech pack view's mm | cm | in toggle. Every length the view holds is in millimetres. */
describe("the unit toggle", () => {
  it("offers exactly the three units the spec names, each with a label and a whole word", () => {
    expect(LENGTH_UNITS).toEqual(["mm", "cm", "in"]);
    for (const unit of LENGTH_UNITS) {
      expect(UNIT_LABELS[unit]).toBe(unit);
      expect(UNIT_NAMES[unit].length).toBeGreaterThan(unit.length);
    }
  });

  it("reads 520 mm as the same length in all three units", () => {
    expect(formatLength(520, "mm")).toBe("520");
    expect(formatLength(520, "cm")).toBe("52.0");
    expect(formatLength(520, "in")).toBe("20.47");
  });

  it("uses the international inch, so 25.4 mm is exactly one inch", () => {
    expect(formatLength(25.4, "in")).toBe("1.00");
    expect(formatLength(254, "in")).toBe("10.00");
  });

  it("leaves a length nobody has empty, and never reads it as a zero", () => {
    for (const unit of LENGTH_UNITS) {
      expect(formatLength(null, unit)).toBeNull();
      expect(formatLengthWithUnit(null, unit)).toBeNull();
      expect(formatSigned(null, unit, "+")).toBeNull();
    }
  });

  it("refuses a number that is not a number", () => {
    expect(formatLength(Number.NaN, "mm")).toBeNull();
    expect(formatLength(Number.POSITIVE_INFINITY, "cm")).toBeNull();
  });

  it("puts the unit after a length that stands on its own", () => {
    expect(formatLengthWithUnit(520, "mm")).toBe("520 mm");
    expect(formatLengthWithUnit(520, "cm")).toBe("52.0 cm");
  });

  it("reads a tolerance with its sign, and a zero tolerance without one", () => {
    expect(formatSigned(10, "mm", "+")).toBe("+10");
    expect(formatSigned(10, "mm", "-")).toBe("-10");
    expect(formatSigned(0, "mm", "-")).toBe("0");
    expect(formatSigned(0, "in", "+")).toBe("0.00");
  });
});
