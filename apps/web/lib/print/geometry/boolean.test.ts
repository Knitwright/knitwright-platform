import { describe, expect, it } from "vitest";
import { clipToOutline, shapesArea, subtractRegions } from "./boolean";
import { rect } from "./vec";

describe("boolean", () => {
  const outline = rect(0, 0, 100, 100);
  it("keeps a shape that is wholly inside, untouched", () => {
    const inside = rect(10, 10, 20, 20);
    expect(clipToOutline([[inside]], outline)).toEqual([[inside]]);
  });
  it("drops a shape that is wholly outside", () => {
    expect(clipToOutline([[rect(200, 200, 210, 210)]], outline)).toEqual([]);
  });
  it("cuts a shape that crosses the outline", () => {
    const out = clipToOutline([[rect(90, 90, 110, 110)]], outline);
    expect(shapesArea(out)).toBeCloseTo(100, 6);
  });
  it("removes a region from a shape and keeps the hole", () => {
    const out = subtractRegions([[rect(0, 0, 100, 100)]], [rect(40, 40, 60, 60)]);
    expect(out).toHaveLength(1);
    expect(out[0]).toHaveLength(2);
    expect(shapesArea(out)).toBeCloseTo(10000 - 400, 6);
  });
  it("leaves a shape alone when no region touches it", () => {
    const shape = [rect(0, 0, 10, 10)];
    expect(subtractRegions([shape], [rect(50, 50, 60, 60)])).toEqual([shape]);
  });
  it("returns nothing when the region covers the shape", () => {
    expect(subtractRegions([[rect(10, 10, 20, 20)]], [rect(0, 0, 100, 100)])).toEqual([]);
  });
});
