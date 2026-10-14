import { describe, expect, it } from "vitest";
import { shapeArea } from "../geometry/boolean";
import { rect } from "../geometry/vec";
import { keepClear } from "./clear-space";

describe("keepClear", () => {
  const region = rect(40, 40, 60, 60);
  it("drops a small motif whole when it touches the region", () => {
    expect(keepClear([[rect(35, 35, 45, 45)]], [region])).toEqual([]);
  });
  it("keeps a motif that does not touch", () => {
    const motif = [rect(0, 0, 10, 10)];
    expect(keepClear([motif], [region])).toEqual([motif]);
  });
  it("cuts a big shape to the region instead of dropping it", () => {
    const big = [rect(0, 0, 200, 200)];
    const out = keepClear([big], [region]);
    expect(out).toHaveLength(1);
    expect(shapeArea(out[0])).toBeCloseTo(40000 - 400, 6);
  });
  it("changes nothing without regions", () => {
    expect(keepClear([[rect(0, 0, 1, 1)]], [])).toHaveLength(1);
  });
});
