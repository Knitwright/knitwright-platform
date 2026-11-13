import { describe, expect, it } from "vitest";
import { readGarmentInspectorSchema } from "./input";

describe("what the garment inspector's read takes", () => {
  it("takes a design id, a colourway and option codes, and nothing that is not a code", () => {
    const designId = "00000000-0000-4000-8000-0000000000d1";
    expect(readGarmentInspectorSchema.safeParse({ designId, colourwayId: "away", options: { collar: "C02" } }).success).toBe(true);
    expect(readGarmentInspectorSchema.safeParse({ designId: "nope" }).success).toBe(false);
    expect(readGarmentInspectorSchema.safeParse({ designId, options: { collar: "C02; drop" } }).success).toBe(false);
    const many = Object.fromEntries(Array.from({ length: 33 }, (_, n) => [`g${n}`, "C01"]));
    expect(readGarmentInspectorSchema.safeParse({ designId, options: many }).success).toBe(false);
  });
});
