import { describe, expect, it } from "vitest";
import { rosterContextOf } from "./context";

const marks = (places: string[]) => ({ places: places.map((place) => ({ place })) }) as never;

describe("rosterContextOf", () => {
  it("reads the run and finds a name place", () => {
    expect(rosterContextOf({ sizing: { sizes: ["S", "M"], baseSize: "M" }, namesAndNumbers: marks(["back-name", "back-number"]) })).toEqual({ run: ["S", "M"], hasNamePlace: true });
  });
  it("finds no name place when only numbers are placed", () => {
    expect(rosterContextOf({ sizing: null, namesAndNumbers: marks(["back-number"]) })).toEqual({ run: [], hasNamePlace: false });
  });
  it("copes with a design that has neither", () => {
    expect(rosterContextOf({ sizing: null })).toEqual({ run: [], hasNamePlace: false });
  });
});
