import { describe, expect, it } from "vitest";
import { rig } from "../fixtures/setup";
import { joinFor, reflectBox, reflectShape, seamJoinFor } from "./seam";

describe("the seam join", () => {
  const r = rig(["48"]);

  it("is the two underarm landmarks' x on the design plane, which is nothing when the pieces are the same width", () => {
    expect(Math.abs(seamJoinFor(r.mapper.placed("48")) ?? 1)).toBeLessThan(1e-6);
  });

  it("is undefined when the front or the back has no underarm landmark", () => {
    const placed = r.mapper.placed("48");
    const stripped = placed.map((entry) => (entry.instance.view === "back" ? { ...entry, instance: { ...entry.instance, piece: { ...entry.instance.piece, landmarks: {} } } } : entry));
    expect(seamJoinFor(stripped)).toBeUndefined();
    expect(seamJoinFor(placed.filter((entry) => entry.instance.view !== "front"))).toBeUndefined();
    const nonsense = placed.map((entry) => ({ ...entry, frame: { toDesign: [Number.NaN, 0, 0, 1, 0, 0] as const } }));
    expect(seamJoinFor(nonsense)).toBeUndefined();
  });

  it("is used for a newer style on the back only, never for the older styles", () => {
    expect(joinFor("back", "camo", 4)).toBe(4);
    expect(joinFor("front", "camo", 4)).toBeUndefined();
    expect(joinFor("back", "kit-dots", 4)).toBeUndefined();
    expect(joinFor("back", "camo", undefined)).toBeUndefined();
  });

  it("turns a box and the shapes in it about the join", () => {
    expect(reflectBox({ minX: -10, maxX: 30, minY: 1, maxY: 2 }, 6)).toEqual({ minX: -24, maxX: 16, minY: 1, maxY: 2 });
    expect(reflectShape({ kind: "circle", centre: { x: 2, y: 5 }, radius: 3, fill: "#000000" }, 6)).toMatchObject({ centre: { x: 4, y: 5 }, radius: 3 });
    expect(reflectShape({ kind: "polygon", points: [{ x: 1, y: 1 }, { x: 3, y: 2 }], fill: "#000000" }, 6)).toMatchObject({ points: [{ x: 5, y: 1 }, { x: 3, y: 2 }] });
  });
});
