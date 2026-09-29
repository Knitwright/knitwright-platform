import { describe, expect, it } from "vitest";
import {
  EMPTY_FABRIC_DETAILS,
  artworkSchema,
  colourwaySchema,
  fabricSchema,
  measurementSchema,
} from "./parts";
import { MEASUREMENT_MAX_TENTHS_MM } from "./units";

const FILE_ID = "3f0c2c9e-6f0a-4d0e-9a51-0d6c1c1f7a11";
const artwork = {
  id: "a1",
  source: { kind: "file", fileId: FILE_ID },
  panelId: "body-front",
  anchor: "centre-chest",
  offsetX: 0,
  offsetY: -200,
  width: 1000,
  height: 800,
  technique: "sublimation",
};

describe("measurement", () => {
  const ok = { pointId: "chest-width", value: 5250, provenance: "user-edited" };

  it("accepts a whole number with provenance", () => {
    expect(measurementSchema.safeParse(ok).success).toBe(true);
  });

  it("rejects a measurement with no provenance", () => {
    expect(measurementSchema.safeParse({ pointId: "chest-width", value: 5250 }).success).toBe(false);
  });

  it("rejects a value that is not a whole number", () => {
    expect(measurementSchema.safeParse({ ...ok, value: 52.5 }).success).toBe(false);
  });

  it("rejects zero, negative and oversized values", () => {
    for (const value of [0, -1, MEASUREMENT_MAX_TENTHS_MM + 1, Number.NaN]) {
      expect(measurementSchema.safeParse({ ...ok, value }).success).toBe(false);
    }
    expect(measurementSchema.safeParse({ ...ok, value: MEASUREMENT_MAX_TENTHS_MM }).success).toBe(true);
  });

  it("rejects the provenance word verified", () => {
    expect(measurementSchema.safeParse({ ...ok, provenance: "verified" }).success).toBe(false);
  });
});

describe("fabric", () => {
  const blank = { id: "main", name: "Main fabric", ...EMPTY_FABRIC_DETAILS, provenance: "user-edited" };

  it("accepts an empty fabric that has a name and provenance", () => {
    expect(fabricSchema.safeParse(blank).success).toBe(true);
  });

  it("accepts a filled fabric and trims its text", () => {
    const parsed = fabricSchema.parse({
      ...blank,
      name: " Mesh ",
      composition: " 100% polyester ",
      construction: "pique",
      weightGsm: 160,
      finish: "moisture wicking",
      stretch: "two-way",
    });
    expect(parsed.composition).toBe("100% polyester");
    expect(parsed.name).toBe("Mesh");
  });

  it("rejects an unknown stretch, a zero weight and an overlong composition", () => {
    expect(fabricSchema.safeParse({ ...blank, stretch: "elastic" }).success).toBe(false);
    expect(fabricSchema.safeParse({ ...blank, weightGsm: 0 }).success).toBe(false);
    expect(fabricSchema.safeParse({ ...blank, composition: "x".repeat(300) }).success).toBe(false);
  });

  it("rejects a fabric with no name, no provenance or the word verified", () => {
    expect(fabricSchema.safeParse({ ...blank, name: "  " }).success).toBe(false);
    const without = Object.fromEntries(Object.entries(blank).filter(([key]) => key !== "provenance"));
    expect(fabricSchema.safeParse(without).success).toBe(false);
    expect(fabricSchema.safeParse({ ...blank, provenance: "verified" }).success).toBe(false);
  });
});

describe("colourway", () => {
  it("accepts free text colour codes", () => {
    const result = colourwaySchema.safeParse({
      id: "main",
      name: "Home kit",
      colours: [{ panelId: "body-front", colour: "PANTONE 19-4052 or #1B2A49" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty name, an empty colour and a repeated panel", () => {
    const base = { id: "main", name: "Home", colours: [] };
    expect(colourwaySchema.safeParse({ ...base, name: "  " }).success).toBe(false);
    expect(
      colourwaySchema.safeParse({ ...base, colours: [{ panelId: "body-front", colour: " " }] })
        .success,
    ).toBe(false);
    const twice = { panelId: "body-front", colour: "navy" };
    expect(colourwaySchema.safeParse({ ...base, colours: [twice, twice] }).success).toBe(false);
  });
});

describe("artwork", () => {
  it("accepts a file artwork with a technique", () => {
    expect(artworkSchema.safeParse(artwork).success).toBe(true);
  });

  it("accepts text artwork", () => {
    const text = { ...artwork, source: { kind: "text", text: "CLUB 1987" }, technique: "embroidery" };
    expect(artworkSchema.safeParse(text).success).toBe(true);
  });

  it("accepts all four techniques and no others", () => {
    for (const technique of ["sublimation", "transfer", "screen-print", "embroidery"]) {
      expect(artworkSchema.safeParse({ ...artwork, technique }).success).toBe(true);
    }
    expect(artworkSchema.safeParse({ ...artwork, technique: "dtg" }).success).toBe(false);
  });

  it("rejects a file id that is not a uuid", () => {
    const bad = { ...artwork, source: { kind: "file", fileId: "logo.png" } };
    expect(artworkSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects empty text, a zero size and fractional offsets", () => {
    const blank = { ...artwork, source: { kind: "text", text: " " } };
    expect(artworkSchema.safeParse(blank).success).toBe(false);
    expect(artworkSchema.safeParse({ ...artwork, width: 0 }).success).toBe(false);
    expect(artworkSchema.safeParse({ ...artwork, offsetX: 1.5 }).success).toBe(false);
  });

  it("allows negative offsets and rejects offsets past the limit", () => {
    expect(artworkSchema.safeParse({ ...artwork, offsetX: -500 }).success).toBe(true);
    const far = { ...artwork, offsetX: MEASUREMENT_MAX_TENTHS_MM + 1 };
    expect(artworkSchema.safeParse(far).success).toBe(false);
  });
});
