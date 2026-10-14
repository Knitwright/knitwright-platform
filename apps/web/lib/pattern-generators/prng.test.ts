import { describe, expect, it } from "vitest";
import { createRng, hashSeed } from "./prng";

describe("the seeded generator", () => {
  it("gives the same numbers for the same seed, and others for another seed", () => {
    const [a, b, c] = [createRng(7), createRng(7), createRng(8)];
    const take = (rng: ReturnType<typeof createRng>) => Array.from({ length: 5 }, () => rng.next());
    expect(take(a)).toEqual(take(b));
    expect(take(createRng(7))).not.toEqual(take(c));
  });

  it("stays in its ranges", () => {
    const rng = createRng(123);
    for (let at = 0; at < 500; at += 1) {
      const [f, n, r] = [rng.float(), rng.int(5), rng.range(-2, 3)];
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      expect([0, 1, 2, 3, 4]).toContain(n);
      expect(r).toBeGreaterThanOrEqual(-2);
      expect(r).toBeLessThan(3);
    }
  });

  it("is a fixed sequence (so a change to it is seen)", () => {
    expect(Array.from({ length: 3 }, ((rng) => () => rng.next())(createRng(1)))).toMatchInlineSnapshot(`
      [
        2527132011,
        314344336,
        2535364964,
      ]
    `);
  });

  it("hashes positions to one number each, and tells neighbours apart", () => {
    expect(hashSeed(7, 1, 2)).toBe(hashSeed(7, 1, 2));
    const seen = new Set(Array.from({ length: 200 }, (_, at) => hashSeed(7, at % 20, Math.floor(at / 20))));
    expect(seen.size).toBe(200);
    expect(hashSeed(7, -1, 0)).not.toBe(hashSeed(7, 1, 0));
  });
});
