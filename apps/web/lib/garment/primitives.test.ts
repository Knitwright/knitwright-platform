import { describe, expect, it } from "vitest";
import { familySchema, freeText, kebabId, localId, wearerSchema } from "./primitives";

describe("primitives", () => {
  it("knows the three wearers", () => {
    expect(wearerSchema.options).toEqual(["men", "women", "youth"]);
    expect(wearerSchema.safeParse("kids").success).toBe(false);
  });

  it("knows the garment families", () => {
    expect(familySchema.options).toEqual(["tops", "bottoms", "outerwear", "close-fitting", "football", "cricket", "winter-code"]);
  });

  it("accepts kebab-case ids and rejects other shapes", () => {
    for (const ok of ["crew-tee", "polo", "a1-b2"]) {
      expect(kebabId.safeParse(ok).success).toBe(true);
    }
    for (const bad of ["Crew-Tee", "crew_tee", "-tee", "tee-", "tee--x", "1tee", "", " tee"]) {
      expect(kebabId.safeParse(bad).success).toBe(false);
    }
  });

  it("accepts a uuid or a short word as a local id and rejects spaces and slashes", () => {
    expect(localId.safeParse("3f0c2c9e-6f0a-4d0e-9a51-0d6c1c1f7a11").success).toBe(true);
    expect(localId.safeParse("main").success).toBe(true);
    for (const bad of ["", "a b", "a/b", "x".repeat(65)]) {
      expect(localId.safeParse(bad).success).toBe(false);
    }
  });

  it("trims free text", () => {
    expect(freeText(10).parse("  navy  ")).toBe("navy");
  });

  it("enforces the maximum length after trimming", () => {
    expect(freeText(3).safeParse("  abc  ").success).toBe(true);
    expect(freeText(3).safeParse("abcd").success).toBe(false);
  });

  it("rejects line breaks and control characters", () => {
    expect(freeText(20).safeParse("navy\nblue").success).toBe(false);
    expect(freeText(20).safeParse("navy\u0000").success).toBe(false);
  });

  it("keeps text that looks like code exactly as typed", () => {
    const text = "<script>alert(1)</script> ${x} '; DROP TABLE";
    expect(freeText(100).parse(text)).toBe(text);
  });

  it("keeps emoji and non-Latin text", () => {
    expect(freeText(20).parse("Rouge 🔴 深蓝")).toBe("Rouge 🔴 深蓝");
  });
});
