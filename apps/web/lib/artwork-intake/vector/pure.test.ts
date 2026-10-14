import { describe, expect, it } from "vitest";
import { Budget } from "./budget";
import { parseColour } from "./colour";
import { IDENTITY, apply, isIdentity, meanScale, multiply, parseTransform } from "./matrix";
import { parsePathData, polyPath, shapePath } from "./path-data";
import { REFUSALS } from "./refuse";

describe("parseColour", () => {
  it("reads hex, rgb, names and transparency", () => {
    expect(parseColour("#fff")).toEqual({ hex: "#ffffff", alpha: 1 });
    expect(parseColour("#ff000080")).toEqual({ hex: "#ff0000", alpha: 128 / 255 });
    expect(parseColour("#f008")).toEqual({ hex: "#ff0000", alpha: 136 / 255 });
    expect(parseColour("rgb(10, 20, 30)")).toEqual({ hex: "#0a141e", alpha: 1 });
    expect(parseColour("rgba(100%, 0%, 0%, 50%)")).toEqual({ hex: "#ff0000", alpha: 0.5 });
    expect(parseColour("  Navy ")).toEqual({ hex: "#000080", alpha: 1 });
    expect(parseColour("transparent")).toEqual({ hex: "#000000", alpha: 0 });
  });

  it("returns null for what is not a colour", () => {
    for (const bad of ["", "nope", "#12", "rgb(1,2)", "rgb(a,b,c)", "rgba(1,2,3,x)", "url(#a)", "rgb(1 2 3 4 5)"]) expect(parseColour(bad)).toBeNull();
  });
});

describe("transforms", () => {
  it("composes a list left to right", () => {
    const m = parseTransform("translate(10 20) scale(2)");
    expect(m && apply(m, 1, 1)).toEqual([12, 22]);
    const turn = parseTransform("rotate(90)");
    expect(turn && apply(turn, 1, 0).map((v) => Math.round(v))).toEqual([0, 1]);
    const about = parseTransform("rotate(180 5 5)");
    expect(about && apply(about, 5, 5).map((v) => Math.round(v))).toEqual([5, 5]);
    expect(parseTransform("matrix(1,0,0,1,5,6)")).toEqual([1, 0, 0, 1, 5, 6]);
    expect(parseTransform("skewX(45) skewY(0) scale(2 3)")).not.toBeNull();
  });

  it("treats nothing as no change and refuses malformed lists", () => {
    expect(parseTransform(undefined)).toEqual(IDENTITY);
    expect(parseTransform("  ")).toEqual(IDENTITY);
    for (const bad of ["scale(", "spin(3)", "translate(1 2 3)", "matrix(1 2)", "rotate(1 2)", "scale(1) junk", "skewX()"]) expect(parseTransform(bad)).toBeNull();
  });

  it("knows an identity and a mean scale", () => {
    expect(isIdentity(IDENTITY)).toBe(true);
    expect(isIdentity([2, 0, 0, 1, 0, 0])).toBe(false);
    expect(meanScale([2, 0, 0, 8, 0, 0])).toBe(4);
    expect(multiply(IDENTITY, [1, 2, 3, 4, 5, 6])).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("parsePathData", () => {
  const parse = (d: string) => parsePathData(d, new Budget());

  it("reads absolute and relative lines and closes", () => {
    expect(parse("M10 10 L20 10 l0 10 H10 v-10 z")).toEqual([["M", 10, 10], ["L", 20, 10], ["L", 20, 20], ["L", 10, 20], ["L", 10, 10], ["Z"]]);
  });

  it("treats extra pairs after a move as lines and accepts compact numbers", () => {
    expect(parse("m1,1 2,2-1-1")).toEqual([["M", 1, 1], ["L", 3, 3], ["L", 2, 2]]);
    expect(parse("M.5.5L1e1 2E0")).toEqual([["M", 0.5, 0.5], ["L", 10, 2]]);
  });

  it("turns quadratics, smooth curves and arcs into cubics", () => {
    const quad = parse("M0 0 Q10 10 20 0 T40 0");
    expect(quad?.map((c) => c[0])).toEqual(["M", "C", "C"]);
    const smooth = parse("M0 0 C0 10 10 10 10 0 S20 -10 20 0");
    expect(smooth?.[2]).toEqual(["C", 10, -10, 20, -10, 20, 0]);
    const arc = parse("M0 0 A10 10 0 0 1 20 0");
    expect(arc?.every((c, i) => (i === 0 ? c[0] === "M" : c[0] === "C"))).toBe(true);
    const last = arc?.at(-1);
    expect(last && last[0] === "C" && [last[5], last[6]]).toEqual([20, 0]);
    expect(parse("m0 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0")?.length).toBeGreaterThan(4);
    expect(parse("M0 0 A0 5 0 0 1 10 0")).toEqual([["M", 0, 0], ["L", 10, 0]]);
    expect(parse("M0 0 A5 5 0 0 1 0 0")).toEqual([["M", 0, 0]]);
    expect(parse("M0 0 A2 2 45 0 0 10 0")?.length).toBeGreaterThan(1);
  });

  it("returns null for malformed data and nothing for empty data", () => {
    expect(parse("")).toEqual([]);
    expect(parse("L10 10")).toBeNull();
    expect(parse("M10")).toBeNull();
    expect(parse("M10 10 X")).toBeNull();
    expect(parse("M0 0 A5 5 0 2 0 10 0")).toBeNull();
    expect(parse("M0 0 Z 5 5")).toBeNull();
    expect(parse("M0 0 L 1 x")).toBeNull();
  });

  it("builds circles, rectangles and polygons", () => {
    expect(shapePath.circle(0, 0, 5, 5)).toHaveLength(6);
    expect(shapePath.rectangle(0, 0, 10, 5, 0, 0)).toHaveLength(5);
    expect(shapePath.rectangle(0, 0, 10, 5, 2, 2)).toHaveLength(10);
    expect(polyPath("0,0 10,0 10,10", true)).toEqual([["M", 0, 0], ["L", 10, 0], ["L", 10, 10], ["Z"]]);
    expect(polyPath("0,0 10,0", false)).toEqual([["M", 0, 0], ["L", 10, 0]]);
    expect(polyPath("0,0 10", false)).toBeNull();
    expect(polyPath("", false)).toBeNull();
  });
});

describe("Budget", () => {
  it("stops a file with too many path commands, too many elements, too deep nesting, or too long a read", () => {
    expect(() => new Budget().pathCommands(300_000)).toThrow(REFUSALS.tooComplex);
    const many = new Budget();
    expect(() => {
      for (let i = 0; i < 30_000; i += 1) many.element(1);
    }).toThrow(REFUSALS.tooComplex);
    expect(() => new Budget().element(99)).toThrow(REFUSALS.tooDeep);
    let now = 0;
    const slow = new Budget(() => now);
    now = 60_000;
    expect(() => {
      for (let i = 0; i < 300; i += 1) slow.tick();
    }).toThrow(REFUSALS.tooSlow);
  });
});
