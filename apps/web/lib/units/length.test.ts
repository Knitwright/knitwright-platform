import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { cmToInches, formatLength, inchesToCm, lengthUnitFrom, CM_PER_INCH } from "./length";

describe("lengths in centimetres or inches", () => {
  it("uses 2.54 centimetres to the inch", () => {
    expect(CM_PER_INCH).toBe(2.54);
    expect(cmToInches(2.54)).toBe(1);
    expect(inchesToCm(20)).toBeCloseTo(50.8, 10);
  });

  it("turns there and back without drift", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 500, noNaN: true }), (cm) => {
        expect(inchesToCm(cmToInches(cm))).toBeCloseTo(cm, 9);
      }),
    );
  });

  it("writes centimetres to one decimal", () => {
    expect(formatLength(52, "cm")).toBe("52.0 cm");
    expect(formatLength(52.46, "cm")).toBe("52.5 cm");
  });

  it("writes inches to the nearest eighth, as a factory tape reads", () => {
    expect(formatLength(50.8, "in")).toBe("20 in");
    expect(formatLength(52, "in")).toBe("20 1/2 in");
    expect(formatLength(2.54 * 0.125, "in")).toBe("1/8 in");
    expect(formatLength(2.54 * 3.75, "in")).toBe("3 3/4 in");
    expect(formatLength(2.54 * 5.99, "in")).toBe("6 in");
  });

  it("reads the unit from an address or a saved choice, centimetres unless inches are named", () => {
    expect(lengthUnitFrom("in")).toBe("in");
    expect(lengthUnitFrom("cm")).toBe("cm");
    expect(lengthUnitFrom(undefined)).toBe("cm");
    expect(lengthUnitFrom(["in"])).toBe("cm");
    expect(lengthUnitFrom("feet")).toBe("cm");
  });
});
