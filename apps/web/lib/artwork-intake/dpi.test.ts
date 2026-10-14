import { describe, expect, it } from "vitest";
import { dpiWarning, effectiveDpi, largestWidthMm } from "./dpi";

describe("effectiveDpi", () => {
  it("is pixels over the printed width in inches", () => {
    expect(effectiveDpi({ widthPx: 1000 }, 400)).toBeCloseTo(63.5, 1);
    expect(effectiveDpi({ widthPx: 6000 }, 254)).toBeCloseTo(600, 6);
  });

  it("is refused for a width that is not a length", () => {
    expect(() => effectiveDpi({ widthPx: 1000 }, 0)).toThrow(/width/);
    expect(() => effectiveDpi({ widthPx: 1000 }, Number.NaN)).toThrow(/width/);
  });
});

describe("largestWidthMm", () => {
  it("is the widest print that still meets the minimum", () => {
    expect(largestWidthMm({ widthPx: 1500 }, 150)).toBeCloseTo(254, 6);
  });
});

describe("dpiWarning", () => {
  const asset = { kind: "raster" as const, widthPx: 1000 };

  it("gives the plain sentence with the dpi to the nearest 1 and the largest size that works", () => {
    const warning = dpiWarning(asset, 264.583, 150);
    expect(warning).toContain("This picture would print at about 96 dpi at this size.");
    expect(warning).toContain("Your print house asks for 150 or more, so it may look soft.");
    expect(warning).toContain("Use a larger file, or make it smaller on the shirt.");
    expect(warning).toContain("largest size at which it still meets 150 dpi is about 169 mm wide");
  });

  it("says nothing when the dpi is enough, and never warns for a vector", () => {
    expect(dpiWarning(asset, 100, 150)).toBeNull();
    expect(dpiWarning({ kind: "vector", widthPx: 10 }, 5000, 150)).toBeNull();
  });
});
