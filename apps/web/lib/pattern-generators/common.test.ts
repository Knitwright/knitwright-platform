import { describe, expect, it } from "vitest";
import { along, cellsAround, coloursAvailable, FALLBACK_INK, inksOf, mixHex, numberParam, valuesOf } from "./common";
import { contextOf } from "./fixtures/contexts";

const spec = numberParam({ id: "a", label: "A", unit: "mm", min: 1, max: 5, step: 1, default: 3, up: ["more"], down: ["less"] });

describe("common helpers", () => {
  it("keeps a setting within its range and falls back to the default", () => {
    expect(valuesOf([spec], { a: 99 })).toEqual({ a: 5 });
    expect(valuesOf([spec], { a: -3 })).toEqual({ a: 1 });
    expect(valuesOf([spec], {})).toEqual({ a: 3 });
    expect(valuesOf([spec], { a: "x" })).toEqual({ a: 3 });
    expect(valuesOf([spec], { a: Number.NaN })).toEqual({ a: 3 });
    expect(valuesOf([spec], { a: true })).toEqual({ a: 1 });
    expect(valuesOf([{ ...spec, default: null }], {})).toEqual({ a: 1 });
  });

  it("repeats colours to fill the places", () => {
    expect(inksOf(contextOf({ colours: ["#111111", "#222222"] }), 3)).toEqual(["#111111", "#222222", "#111111"]);
    expect(inksOf(contextOf({ colours: [] }), 1)).toEqual([FALLBACK_INK]);
    expect(coloursAvailable(contextOf({ colours: ["#111111"] }), 4)).toBe(1);
    expect(coloursAvailable(contextOf({ colours: [] }), 4)).toBe(1);
  });

  it("mixes colours", () => {
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mixHex("red", "#ffffff", 0.5)).toBe("red");
    expect(along(["#000000"], 0.3)).toBe("#000000");
    expect(along(["#000000", "#ffffff"], 2)).toBe("#ffffff");
    expect(along(["#000000", "#ffffff", "#000000"], 0.5)).toBe("#ffffff");
  });

  it("lists the cells around a box", () => {
    expect(cellsAround({ minX: 0, minY: 0, maxX: 10, maxY: 10 }, { x: 0, y: 0 }, 5, 5, 1)).toEqual({ i0: -1, i1: 2, j0: -1, j1: 2 });
  });
});
