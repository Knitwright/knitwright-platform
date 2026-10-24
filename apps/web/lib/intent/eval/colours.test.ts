import { describe, expect, it } from "vitest";
import { COLOUR_TOLERANCE, deltaE, extractColours, matchColours } from "./colours";

describe("deltaE", () => {
  it("is zero for the same colour and large for opposites", () => {
    expect(deltaE("#1b2a49", "#1b2a49")).toBe(0);
    expect(deltaE("#000000", "#ffffff")).toBeGreaterThan(90);
  });
  it("is symmetric", () => {
    expect(deltaE("#c8102e", "#1d4fb8")).toBeCloseTo(deltaE("#1d4fb8", "#c8102e"), 6);
  });
});

describe("matchColours", () => {
  it("matches in any order and counts extras", () => {
    expect(matchColours(["#ffffff", "#111111"], ["#111111", "#fefefe", "#ff0000"])).toEqual({ matched: 2, extra: 1 });
  });
  it("uses each found colour once", () => {
    expect(matchColours(["#ffffff", "#fefefe"], ["#ffffff"])).toEqual({ matched: 1, extra: 0 });
  });
  it("does not match colours further apart than the tolerance", () => {
    expect(deltaE("#c8102e", "#1d4fb8")).toBeGreaterThan(COLOUR_TOLERANCE);
    expect(matchColours(["#c8102e"], ["#1d4fb8"])).toEqual({ matched: 0, extra: 1 });
  });
  it("handles nothing expected or nothing found", () => {
    expect(matchColours([], [])).toEqual({ matched: 0, extra: 0 });
    expect(matchColours(["#ffffff"], [])).toEqual({ matched: 0, extra: 0 });
  });
});

describe("extractColours", () => {
  it("reads listed names, longest first, once each", () => {
    expect(extractColours("royal blue and white, with more white")).toEqual(["#1d4fb8", "#ffffff"]);
  });
  it("reads hex codes", () => {
    expect(extractColours("jersey #1B2A49 with #f2b705 trim")).toEqual(["#1b2a49", "#f2b705"]);
  });
  it("does not find a colour inside another word", () => {
    expect(extractColours("a shredded blackboard")).toEqual([]);
  });
  it("misses names the table does not list", () => {
    expect(extractColours("emerald and mustard")).toEqual([]);
  });
});
