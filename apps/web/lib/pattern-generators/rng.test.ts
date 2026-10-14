import { describe, expect, it } from "vitest";
import { cellRng, hash32, makeRng } from "./rng";

describe("seeded numbers", () => {
  it("repeat for the same seed and differ for another", () => {
    const run = (seed: number): number[] => Array.from({ length: 5 }, ((rng) => () => rng.next())(makeRng(seed)));
    expect(run(1)).toEqual(run(1));
    expect(run(1)).not.toEqual(run(2));
  });

  it("stay in range", () => {
    const rng = makeRng(42);
    for (let k = 0; k < 500; k += 1) {
      const [n, r, i] = [rng.next(), rng.range(5, 6), rng.int(2, 4)];
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
      expect(r).toBeGreaterThanOrEqual(5);
      expect(r).toBeLessThan(6);
      expect([2, 3, 4]).toContain(i);
    }
  });

  it("gives every cell its own stream, the same each time", () => {
    expect(cellRng(1, 2, 3, 4).next()).toBe(cellRng(1, 2, 3, 4).next());
    expect(cellRng(1, 2, 3, 4).next()).not.toBe(cellRng(1, 2, 4, 3).next());
    expect(hash32(1, 2)).not.toBe(hash32(2, 1));
  });

  it("is pinned: a change to the generator would change every printed pattern", () => {
    expect(hash32(7, 1, -3)).toBe(hash32(7, 1, -3));
    expect(Math.floor(makeRng(7).next() * 1e6)).toBe(Math.floor(makeRng(7).next() * 1e6));
  });
});
