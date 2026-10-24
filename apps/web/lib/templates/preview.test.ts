import { describe, expect, it } from "vitest";
import { previewOf } from "./preview";
import { buildSeedTemplates } from "./seed/build";

describe("the preview of a template", () => {
  it("draws the front of every starter with the existing flat renderer, as an image address", () => {
    for (const seed of buildSeedTemplates()) {
      const preview = previewOf(seed.snapshot);
      expect(preview, seed.slug).not.toBeNull();
      expect(preview!.src.startsWith("data:image/svg+xml")).toBe(true);
      expect(preview!.alt.length).toBeGreaterThan(10);
    }
  });

  it("is the same every time", () => {
    const seed = buildSeedTemplates()[0]!;
    expect(previewOf(seed.snapshot)).toEqual(previewOf(seed.snapshot));
  });

  it("gives nothing for a design that cannot be read", () => {
    expect(previewOf({ typeId: "nothing" })).toBeNull();
    expect(previewOf(undefined)).toBeNull();
  });
});
