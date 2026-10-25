import { describe, expect, it } from "vitest";
import { DEFAULT_THRESHOLDS, THRESHOLDS_NOTE, resolveThresholds } from "./settings";

describe("thresholds", () => {
  it("are labelled as untested defaults", () => {
    expect(THRESHOLDS_NOTE).toBe("Knitwright default, not tested against real generations");
  });

  it("resolve to the defaults with no overrides", () => {
    expect(resolveThresholds()).toEqual(DEFAULT_THRESHOLDS);
  });

  it("take an override and leave the rest", () => {
    const set = resolveThresholds({ maxColourDeltaE: 5 });
    expect(set.maxColourDeltaE).toBe(5);
    expect(set.minMaskOverlap).toBe(DEFAULT_THRESHOLDS.minMaskOverlap);
  });

  it("do not change the defaults", () => {
    resolveThresholds({ maxColourDeltaE: 5 });
    expect(DEFAULT_THRESHOLDS.maxColourDeltaE).toBe(10);
    expect(Object.isFrozen(DEFAULT_THRESHOLDS)).toBe(true);
  });

  it.each([{ maxColourDeltaE: 0 }, { minMaskOverlap: 1.5 }, { minStructureCorrelation: -2 }, { maxAspectDifference: 0.9 }])("reject %o", (bad) => {
    expect(() => resolveThresholds(bad)).toThrow();
  });
});
