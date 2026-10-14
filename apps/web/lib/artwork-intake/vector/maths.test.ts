import { describe, expect, it } from "vitest";
import { parseColour } from "./colour";
import { parsePath } from "./path";
import { parseDeclarations, parseStyleSheet, selectorMatches } from "./style";
import { apply, IDENTITY, isIdentity, multiply, parseTransform } from "./transform";

describe("parseTransform", () => {
  it("reads every kind of step and composes them left to right", () => {
    expect(parseTransform("translate(5)")).toEqual([1, 0, 0, 1, 5, 0]);
    expect(parseTransform("scale(2)")).toEqual([2, 0, 0, 2, 0, 0]);
    expect(parseTransform("scale(2, 3)")).toEqual([2, 0, 0, 3, 0, 0]);
    expect(parseTransform("matrix(1 2 3 4 5 6)")).toEqual([1, 2, 3, 4, 5, 6]);
    const skewX = parseTransform("skewX(45)")!;
    expect(skewX[2]).toBeCloseTo(1, 9);
    const skewY = parseTransform("skewY(45)")!;
    expect(skewY[1]).toBeCloseTo(1, 9);
    const about = parseTransform("rotate(90 10 10)")!;
    const [x, y] = apply(about, 20, 10);
    expect([Math.round(x), Math.round(y)]).toEqual([10, 20]);
    expect(isIdentity(parseTransform("translate(1) translate(-1)")!)).toBe(true);
    expect(multiply(IDENTITY, [1, 0, 0, 1, 2, 3])).toEqual([1, 0, 0, 1, 2, 3]);
  });

  it("gives null for anything it cannot read", () => {
    for (const bad of ["rotate(1 2)", "scale()", "skewX(1 2)", "skewY()", "matrix(1 2 3)", "translate(1 2 3)", "wobble(3)", "translate(a)", "translate(1", "rotate(5) junk"]) {
      expect(parseTransform(bad), bad).toBeNull();
    }
    expect(parseTransform("")).toEqual(IDENTITY);
  });
});

describe("parseColour", () => {
  it("reads hex in all lengths, functions with percentages, hsl and names", () => {
    expect(parseColour("#abcd")).toEqual({ hex: "#aabbcc", opacity: 0.867 });
    expect(parseColour("#112233")).toEqual({ hex: "#112233", opacity: 1 });
    expect(parseColour("rgba(10%, 20%, 30%, 50%)")).toEqual({ hex: "#1a334d", opacity: 0.5 });
    expect(parseColour("rgb(300 -5 0 / 0.25)")).toEqual({ hex: "#ff0000", opacity: 0.25 });
    expect(parseColour("hsla(0, 100%, 50%, 1)")).toEqual({ hex: "#ff0000", opacity: 1 });
    for (const [h, hex] of [[60, "#ffff00"], [120, "#00ff00"], [180, "#00ffff"], [240, "#0000ff"], [300, "#ff00ff"]] as const) {
      expect(parseColour(`hsl(${h}, 100%, 50%)`)?.hex).toBe(hex);
    }
    expect(parseColour("  RED ")).toEqual({ hex: "#ff0000", opacity: 1 });
  });

  it("gives null for what is not a colour", () => {
    for (const bad of ["#12", "#ggg", "#12345", "rgb(1,2)", "rgb(a,b,c)", "rgb(1 2 3 4 5)", "hsl(x,1%,1%)", "notacolour", "", "url(#a)"]) {
      expect(parseColour(bad), bad).toBeNull();
    }
    expect(parseColour("rgb(1,2,3,bad)")?.opacity).toBe(1);
  });
});

describe("style rules", () => {
  it("reads declarations, drops unknown properties and !important, and refuses scripts", () => {
    const map = parseDeclarations("fill: red !important; behaviour: x; stroke:#000;nonsense; color:blue");
    expect([...map.entries()]).toEqual([["fill", "red"], ["stroke", "#000"], ["color", "blue"]]);
    expect(() => parseDeclarations("fill: url(//example.com/x)")).toThrow();
  });

  it("reads simple sheets and counts what it cannot use", () => {
    const sheet = parseStyleSheet("/* note */ .a, rect.b { fill:red } circle{stroke:blue} g > rect{fill:green} @font-face{src:x}");
    expect(sheet.rules.map((rule) => rule.selectors)).toEqual([[".a", "rect.b"], ["circle"]]);
    expect(sheet.skipped).toBeGreaterThanOrEqual(2);
  });

  it("matches element, class and element.class selectors", () => {
    expect(selectorMatches("rect", "rect", [])).toBe(true);
    expect(selectorMatches("RECT", "rect", [])).toBe(true);
    expect(selectorMatches(".a", "rect", ["a", "b"])).toBe(true);
    expect(selectorMatches(".c", "rect", ["a"])).toBe(false);
    expect(selectorMatches("rect.a", "rect", ["a"])).toBe(true);
    expect(selectorMatches("circle.a", "rect", ["a"])).toBe(false);
    expect(selectorMatches("circle", "rect", [])).toBe(false);
  });
});

describe("parsePath", () => {
  const run = (d: string) => parsePath(d, { commands: 0 });

  it("keeps what it can before a mistake", () => {
    expect(run("L 1 1").clean).toBe(false);
    expect(run("M 0 0 5").clean).toBe(false);
    expect(run("M 0").clean).toBe(false);
    expect(run("M 0 0 L 1 1 Z 5").segments).toHaveLength(3);
    expect(run("M 0 0 !").clean).toBe(false);
    expect(run("").segments).toEqual([]);
    expect(run("M 0 0 L 1 1 Z 5").clean).toBe(false);
  });

  it("reflects smooth curves and moves along implied lines", () => {
    const smooth = run("M0 0 C 1 1 2 2 3 3 S 5 5 6 6 Q 1 1 2 2 T 4 4");
    expect(smooth.segments[2]).toEqual(["C", 4, 4, 5, 5, 6, 6]);
    expect(smooth.segments[4]).toEqual(["Q", 3, 3, 4, 4]);
    expect(run("M0 0 S 1 1 2 2").segments[1]).toEqual(["C", 0, 0, 1, 1, 2, 2]);
    expect(run("m1 1 2 2 3 3").segments.map((s) => s[0])).toEqual(["M", "L", "L"]);
    expect(run("M0 0 h5 v5 H0 V0 Z").segments).toHaveLength(6);
  });

  it("draws arcs with every flag and drops degenerate ones", () => {
    for (const flags of ["0 0", "0 1", "1 0", "1 1"]) {
      const arc = run(`M0 0 A 10 5 30 ${flags} 20 10`);
      expect(arc.segments.slice(1).every((s) => s[0] === "C")).toBe(true);
      const end = arc.segments[arc.segments.length - 1];
      expect([end[5], end[6]]).toEqual([20, 10]);
    }
    expect(run("M0 0 A 0 5 0 0 0 9 9").segments[1]).toEqual(["L", 9, 9]);
    expect(run("M3 3 A 5 5 0 0 0 3 3").segments[1]).toEqual(["L", 3, 3]);
    // A radius too small is grown to fit.
    expect(run("M0 0 a 1 1 0 0 1 20 0").segments[1][0]).toBe("C");
  });
});
