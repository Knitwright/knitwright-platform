import { describe, expect, it } from "vitest";
import type { Lab } from "@/lib/design-import/colours";
import { deltaE2000 } from "./ciede2000";

// Pairs from the published test data (Sharma, Wu and Dalal, 2005).
const PAIRS: readonly [Lab, Lab, number][] = [
  [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
  [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
  [[50, 2.5, 0], [50, 0, -2.5], 4.3065],
  [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
  [[2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514], 0.9082],
  [[50, 2.49, -0.001], [50, -2.49, 0.0009], 7.1792],
];

describe("deltaE2000", () => {
  it.each(PAIRS)("matches the published value for %o and %o", (a, b, expected) => {
    expect(deltaE2000(a, b)).toBeCloseTo(expected, 3);
    expect(deltaE2000(b, a)).toBeCloseTo(expected, 3);
  });

  it("is zero for the same colour", () => {
    expect(deltaE2000([40, 20, -10], [40, 20, -10])).toBe(0);
  });

  it("handles two greys (no hue)", () => {
    expect(deltaE2000([50, 0, 0], [60, 0, 0])).toBeGreaterThan(5);
  });
});
