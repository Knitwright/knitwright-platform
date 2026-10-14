import { describe, expect, it } from "vitest";
import { MAX_GARMENT_COLOURS, clusterColours, colourConfidence, deltaE, labToRgb, rgbToLab, toStackColours } from "./colours";
import { blankRaster, filledRect } from "./raster";

describe("Lab", () => {
  it("converts to Lab and back", () => {
    for (const rgb of [[200, 16, 46], [255, 255, 255], [0, 0, 0], [30, 90, 200]] as const) {
      const back = labToRgb(rgbToLab(rgb));
      back.forEach((v, i) => expect(Math.abs(v - rgb[i])).toBeLessThanOrEqual(1));
    }
    expect(rgbToLab([255, 255, 255])[0]).toBeCloseTo(100, 0);
    expect(deltaE(rgbToLab([0, 0, 0]), rgbToLab([255, 255, 255]))).toBeGreaterThan(90);
  });
});

describe("clusterColours", () => {
  const solid = new Uint8Array(100 * 100).fill(1);

  it("finds the colours of a striped garment, largest first, as screen colours", () => {
    let raster = blankRaster(100, 100, [255, 255, 255]);
    raster = filledRect(raster, { x0: 0, y0: 0, x1: 100, y1: 20 }, [0, 40, 160]);
    raster = filledRect(raster, { x0: 0, y0: 40, x1: 100, y1: 60 }, [0, 40, 160]);
    raster = filledRect(raster, { x0: 0, y0: 80, x1: 100, y1: 90 }, [200, 16, 46]);
    const clusters = clusterColours(raster, solid);
    expect(clusters.map((c) => c.hex)).toEqual(["#ffffff", "#0028a0", "#c8102e"]);
    expect(clusters.map((c) => c.share)).toEqual([0.5, 0.4, 0.1]);
  });

  it("merges colours that are nearly the same and drops specks", () => {
    let raster = blankRaster(100, 100, [200, 16, 46]);
    raster = filledRect(raster, { x0: 0, y0: 0, x1: 100, y1: 50 }, [204, 18, 44]);
    raster = filledRect(raster, { x0: 0, y0: 0, x1: 3, y1: 3 }, [10, 200, 10]);
    expect(clusterColours(raster, solid)).toHaveLength(1);
  });

  it("keeps at most the number asked for, and only reads inside the mask", () => {
    let raster = blankRaster(100, 100, [0, 0, 0]);
    const colours = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0], [255, 0, 255], [0, 255, 255], [128, 128, 128], [255, 255, 255]] as const;
    colours.forEach((c, i) => (raster = filledRect(raster, { x0: i * 12, y0: 0, x1: i * 12 + 12, y1: 100 }, c)));
    expect(clusterColours(raster, solid)).toHaveLength(MAX_GARMENT_COLOURS);
    const half = new Uint8Array(100 * 100);
    half.fill(1, 0, 50 * 100);
    expect(clusterColours(blankRaster(100, 100, [9, 9, 9]), new Uint8Array(100 * 100))).toEqual([]);
    expect(clusterColours(raster, half).length).toBeGreaterThan(0);
  });

  it("gives screen colours with no codes, and says less for a photo", () => {
    const clusters = clusterColours(blankRaster(10, 10, [0, 40, 160]), new Uint8Array(100).fill(1));
    const [colour] = toStackColours(clusters);
    expect(colour).toEqual({ id: "colour-1", role: "Ground", screen: "#0028a0", codes: [], provenance: "read-from-image" });
    expect(toStackColours(clusters, 9)[0].role).toBe("Colour 10");
    expect(colourConfidence(clusters, true)).toBeLessThan(colourConfidence(clusters, false));
    expect(colourConfidence([], false)).toBe(0);
  });
});
