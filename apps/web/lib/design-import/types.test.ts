import { describe, expect, it } from "vitest";
import { boxSchema, clamp01, confidenceWords, round2 } from "./types";
import { designImportEnabled } from "./switch";

describe("types", () => {
  it("names confidence in words", () => {
    expect([0.9, 0.5, 0.1].map(confidenceWords)).toEqual(["high", "medium", "low"]);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(-1)).toBe(0);
    expect(round2(0.12345)).toBe(0.12);
  });
  it("accepts a box inside the picture only", () => {
    expect(boxSchema.safeParse({ x: 0.1, y: 0.1, w: 0.5, h: 0.5 }).success).toBe(true);
    expect(boxSchema.safeParse({ x: 1.2, y: 0, w: 0.5, h: 0.5 }).success).toBe(false);
    expect(boxSchema.safeParse({ x: 0, y: 0, w: 0, h: 0.5 }).success).toBe(false);
  });
});

describe("the switch", () => {
  it("is off unless it is exactly on", () => {
    expect(designImportEnabled({})).toBe(false);
    expect(designImportEnabled({ DESIGN_IMPORT: "true" })).toBe(false);
    expect(designImportEnabled({ DESIGN_IMPORT: "on" })).toBe(true);
  });
});
