import { describe, expect, it } from "vitest";
import { allCells, leaves } from "./walk";

describe("allCells", () => {
  it("finds every object that has a status, with the path to it", () => {
    const found = allCells({
      a: { status: "to-be-confirmed" },
      list: [{ deeper: { status: "set", value: "x", provenance: "user-edited" } }],
      plain: { text: "no status here" },
    });
    expect(found.map((entry) => entry.path)).toEqual(["a", "list[0].deeper"]);
  });

  it("finds nothing in a value with no cells", () => {
    expect(allCells({ a: 1, b: ["x"] })).toEqual([]);
    expect(allCells(null)).toEqual([]);
    expect(allCells("text")).toEqual([]);
  });
});

describe("leaves", () => {
  it("lists every string and number with its path, skipping the paths it is told to", () => {
    const value = { a: "x", list: [1, { b: "y" }], skip: { c: "z" } };
    expect(leaves(value, /^skip/).map((entry) => [entry.path, entry.leaf])).toEqual([
      ["a", "x"],
      ["list[0]", 1],
      ["list[1].b", "y"],
    ]);
  });

  it("ignores booleans and nulls", () => {
    expect(leaves({ a: true, b: null })).toEqual([]);
  });
});
