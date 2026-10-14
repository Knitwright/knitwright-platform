import { describe, expect, it } from "vitest";
import { artworkStackSchema, createFakeAssetReader, type ArtworkAsset, type AssetReader } from "@/lib/artwork-stack";
import { checkStackImages, dpiCheck, effectiveDpi, largestWidthMm } from "./effective-dpi";
import { MINIMUM_DPI_LABEL } from "./limits";

const common = { opacity: 1, blend: "normal", provenance: "user-edited", views: ["front"] } as const;

const stack = artworkStackSchema.parse({
  schemaVersion: 1,
  views: ["front"],
  colours: [{ id: "white", role: "ground", codes: [], provenance: "user-edited" }],
  layers: [
    { ...common, kind: "ground", id: "ground", colourId: "white" },
    {
      ...common,
      kind: "image-fill",
      id: "fill",
      assetId: "photo",
      mode: "panel",
      scale: 1.5,
      rotationDeg: 0,
      offsetMm: { x: 0, y: 0 },
      halfDrop: false,
      fit: "cover",
    },
    {
      ...common,
      kind: "graphic",
      id: "crest",
      source: { kind: "asset", assetId: "logo" },
      placement: { kind: "zone", zoneId: "crest" },
      offsetMm: { x: 0, y: 0 },
      widthMm: 400,
      rotationDeg: 0,
      clearSpaceMm: 0,
      knockOut: false,
    },
    {
      ...common,
      kind: "graphic",
      id: "vector-crest",
      source: { kind: "asset", assetId: "vec" },
      placement: { kind: "zone", zoneId: "crest" },
      offsetMm: { x: 0, y: 0 },
      widthMm: 900,
      rotationDeg: 0,
      clearSpaceMm: 0,
      knockOut: false,
    },
    {
      ...common,
      kind: "graphic",
      id: "old-logo",
      source: { kind: "file", fileId: "6f1c1d2e-3b4a-4c5d-8e9f-0a1b2c3d4e5f" },
      placement: { kind: "zone", zoneId: "crest" },
      offsetMm: { x: 0, y: 0 },
      widthMm: 90,
      rotationDeg: 0,
      clearSpaceMm: 0,
      knockOut: false,
    },
    {
      ...common,
      kind: "graphic",
      id: "missing",
      source: { kind: "asset", assetId: "gone" },
      placement: { kind: "zone", zoneId: "crest" },
      offsetMm: { x: 0, y: 0 },
      widthMm: 90,
      rotationDeg: 0,
      clearSpaceMm: 0,
      knockOut: false,
    },
  ],
  colourways: [{ id: "home", name: "Home", colours: {} }],
});

const reader = (dpiMeta: number | null): AssetReader => {
  const base = createFakeAssetReader([
    { id: "photo", kind: "raster", widthPx: 1000, heightPx: 800 },
    { id: "logo", kind: "raster", widthPx: 1000, heightPx: 1000 },
    { id: "vec", kind: "vector", widthPx: 200, heightPx: 200 },
  ]);
  return {
    getAsset: async (id): Promise<ArtworkAsset | null> => {
      const asset = await base.getAsset(id);
      return asset && { ...asset, dpiMeta };
    },
  };
};

describe("effectiveDpi", () => {
  it("is pixels over the printed width in inches", () => {
    expect(effectiveDpi({ widthPx: 1000 }, 25.4)).toBe(1000);
    expect(effectiveDpi({ widthPx: 1000 }, 400)).toBeCloseTo(63.5, 1);
  });

  it("refuses a width that is not a size", () => {
    expect(() => effectiveDpi({ widthPx: 10 }, 0)).toThrow(RangeError);
    expect(() => effectiveDpi({ widthPx: 10 }, Number.NaN)).toThrow(RangeError);
  });
});

describe("dpiCheck", () => {
  it("warns for a 72 dpi, 1000 px picture placed 400 mm wide, to the nearest dpi", () => {
    const check = dpiCheck({ kind: "raster", widthPx: 1000, dpiMeta: 72 }, 400);
    expect(check.dpi).toBe(64);
    expect(check.meets).toBe(false);
    expect(check.warning).toBe(
      "This picture would print at about 64 dpi at this size. Your print house asks for 150 or more, so it may look soft. " +
        "Use a larger file, or make it smaller on the shirt. At 150 dpi this file can print up to 169 mm wide.",
    );
    expect(check.minDpiSource).toBe(MINIMUM_DPI_LABEL);
  });

  it("states the largest size that still meets the minimum", () => {
    expect(largestWidthMm(1500, 150)).toBe(254);
    expect(dpiCheck({ kind: "raster", widthPx: 1500 }, 254).warning).toBeNull();
    expect(dpiCheck({ kind: "raster", widthPx: 1500 }, 255).warning).not.toBeNull();
  });

  it("takes the print house's minimum when it has one", () => {
    expect(dpiCheck({ kind: "raster", widthPx: 1500 }, 200, 300).warning).toContain("asks for 300 or more");
  });

  it("never warns for a vector", () => {
    expect(dpiCheck({ kind: "vector", widthPx: 10 }, 5000)).toMatchObject({ applies: false, dpi: null, warning: null, meets: true });
  });
});

describe("checkStackImages", () => {
  it("checks every placed picture at its printed size and leaves out what it cannot find or read", async () => {
    const checks = await checkStackImages(stack, reader(300));
    expect(checks.map((entry) => entry.layerId)).toEqual(["fill", "crest", "vector-crest"]);
    const [fill, crest, vector] = checks;
    // 1000 px at 300 dpi is 84.7 mm; scale 1.5 makes it 127 mm, so 200 dpi.
    expect(fill.check.dpi).toBe(200);
    expect(fill.check.meets).toBe(true);
    expect(fill.note).toBeNull();
    expect(crest.check.dpi).toBe(64);
    expect(crest.check.warning).toContain("about 64 dpi");
    expect(vector.check.warning).toBeNull();
  });

  it("takes the fabric's print scale into account", async () => {
    const [, crest] = await checkStackImages(stack, reader(300), { printScale: { x: 1.1, y: 1.1 } });
    expect(crest.widthMm).toBe(400);
    expect(crest.check.dpi).toBe(58);
  });

  it("says when a file states no resolution and 72 dpi was taken", async () => {
    const [fill] = await checkStackImages(stack, reader(null));
    expect(fill.note).toMatch(/72 dpi/);
  });

  it("uses the minimum it is given", async () => {
    const [fill] = await checkStackImages(stack, reader(300), { minDpi: 250 });
    expect(fill.check.meets).toBe(false);
  });
});
