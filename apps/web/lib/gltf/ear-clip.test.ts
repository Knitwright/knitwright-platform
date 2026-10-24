import { describe, expect, it } from "vitest";
import { earClip, withoutRepeats } from "./ear-clip";

const areaOf = (ring: readonly (readonly [number, number])[], tris: ReturnType<typeof earClip>) =>
  tris.reduce((sum, [a, b, c]) => {
    const [p, q, r] = [ring[a], ring[b], ring[c]] as [readonly [number, number], readonly [number, number], readonly [number, number]];
    return sum + ((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])) / 2;
  }, 0);

describe("earClip", () => {
  const L = [[0, 0], [4, 0], [4, 2], [2, 2], [2, 4], [0, 4]] as const;

  it("fills a square with two triangles", () => {
    expect(earClip([[0, 0], [1, 0], [1, 1], [0, 1]])).toHaveLength(2);
  });

  it("fills a ring that is not convex without covering the notch", () => {
    expect(areaOf(L, earClip(L))).toBeCloseTo(12, 9);
  });

  it("gives anticlockwise triangles whichever way the ring runs", () => {
    const reversed = [...L].reverse();
    const tris = earClip(reversed);
    expect(areaOf(reversed, tris)).toBeCloseTo(12, 9);
  });

  it("gives nothing for fewer than three points", () => {
    expect(earClip([[0, 0], [1, 1]])).toEqual([]);
  });

  it("still gives a surface for a ring that crosses itself", () => {
    expect(earClip([[0, 0], [2, 2], [2, 0], [0, 2]]).length).toBeGreaterThan(0);
  });

  it("drops repeated points", () => {
    expect(withoutRepeats([[0, 0], [0, 0], [1, 0], [1, 1], [0, 0]])).toEqual([[0, 0], [1, 0], [1, 1]]);
  });
});
