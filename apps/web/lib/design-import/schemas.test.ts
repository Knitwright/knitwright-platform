import { describe, expect, it } from "vitest";
import { RIGHTS_SENTENCE, acceptSchema, createImportSchema, importIdParams, landmarkEditsSchema, refitSchema } from "./schemas";

const id = "55555555-5555-4555-8555-555555555555";

describe("schemas", () => {
  it("needs the rights statement and a file id, and nothing else", () => {
    expect(createImportSchema.safeParse({ fileId: id, rights: true }).success).toBe(true);
    const missing = createImportSchema.safeParse({ fileId: id, rights: false });
    expect(missing.success).toBe(false);
    expect(!missing.success && missing.error.issues[0].message).toBe(RIGHTS_SENTENCE);
    expect(createImportSchema.safeParse({ fileId: "x", rights: true }).success).toBe(false);
    expect(createImportSchema.safeParse({ fileId: id, rights: true, brandId: id }).success).toBe(false);
  });

  it("takes landmark moves as fractions of known names, and not too many", () => {
    expect(refitSchema.safeParse({ edits: { front: { hps: { x: 0.2, y: 0.3 } } } }).success).toBe(true);
    expect(landmarkEditsSchema.safeParse({ front: { hps: { x: 2, y: 0.3 } } }).success).toBe(false);
    expect(landmarkEditsSchema.safeParse({ front: { nonsense: { x: 0.1, y: 0.3 } } }).success).toBe(false);
    const many = Object.fromEntries(["hps", "shoulder-point", "underarm", "cf-neck", "cf-hem", "cb-neck", "cb-hem", "side-hem", "cap-top", "underarm-a", "underarm-b", "hem-a", "hem-b"].map((n) => [n, { x: 0.1, y: 0.1 }]));
    expect(landmarkEditsSchema.safeParse({ front: many, back: many, "sleeve-left": many, "sleeve-right": many }).success).toBe(false);
  });

  it("accepts all layers or a list of them, and a uuid in the path", () => {
    expect(acceptSchema.safeParse({ layerIds: "all" }).success).toBe(true);
    expect(acceptSchema.safeParse({ layerIds: ["ground"] }).success).toBe(true);
    expect(acceptSchema.safeParse({ layerIds: [] }).success).toBe(false);
    expect(importIdParams.safeParse({ importId: id }).success).toBe(true);
    expect(importIdParams.safeParse({ importId: "1" }).success).toBe(false);
  });
});
