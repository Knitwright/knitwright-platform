import { describe, expect, it } from "vitest";
import { seeded, shortHash, shuffled } from "./random";

describe("seeded randomness", () => {
  it("repeats for a seed and stays in [0, 1)", () => {
    const a = seeded(5);
    const b = seeded(5);
    for (let i = 0; i < 50; i += 1) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
  it("shuffles without losing or changing anything", () => {
    const list = [1, 2, 3, 4, 5, 6];
    const out = shuffled(list, 3);
    expect([...out].sort()).toEqual(list);
    expect(list).toEqual([1, 2, 3, 4, 5, 6]);
    expect(shuffled(list, 3)).toEqual(out);
  });
  it("hashes the same text to the same short id", () => {
    expect(shortHash("a")).toBe(shortHash("a"));
    expect(shortHash("a")).not.toBe(shortHash("b"));
    expect(shortHash("a")).toHaveLength(8);
  });
});
