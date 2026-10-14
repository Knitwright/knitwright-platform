import { describe, expect, it } from "vitest";
import { LIMITS } from "@/lib/server/limits";

describe("LIMITS for artwork intake", () => {
  it("holds reading a big picture to no more than two a minute on average", () => {
    expect(LIMITS.artworkIntake.limit / LIMITS.artworkIntake.windowSeconds).toBeLessThanOrEqual(2 / 60);
  });

  it("lets a person try a few changes to one tile, and still holds them to a pace", () => {
    expect(LIMITS.artworkConvert.limit).toBeGreaterThanOrEqual(10);
    expect(LIMITS.artworkConvert.limit / LIMITS.artworkConvert.windowSeconds).toBeLessThanOrEqual(10 / 60);
  });
});
