import { describe, expect, it } from "vitest";
import { matchRules, parseCss, parseDeclarations } from "./css";
import { REFUSALS } from "./refuse";
import { declaredFor, inheritFrom, parseDashes, parseLength, parseNumber, parsePaint, parseShare, ROOT_STYLE } from "./style";

describe("parseCss", () => {
  const { rules, skipped } = parseCss(`
    /* from Illustrator */
    .cls-1, .cls-2 { fill: #ff0000; stroke:none }
    rect.big { fill: blue !important }
    #logo { opacity: .5 }
    g > path { fill: green }
    a:hover { fill: pink }
    @media print { .x { fill: red } }
    * { stroke-width: 2 }
  `);

  it("reads simple rules and counts the ones it skips", () => {
    expect(rules.map((r) => [r.tag, r.classes, r.id])).toEqual([
      [null, ["cls-1"], null],
      [null, ["cls-2"], null],
      ["rect", ["big"], null],
      [null, [], "logo"],
      [null, [], null],
    ]);
    expect(skipped).toBe(3);
  });

  it("matches an element by tag, class and id, later rules over earlier ones", () => {
    const element = { name: "rect", attrs: { class: "cls-1 big", id: "logo" } };
    expect(matchRules(rules, element)).toEqual({ fill: "blue", stroke: "none", opacity: ".5", "stroke-width": "2" });
    expect(matchRules(rules, { name: "circle", attrs: {} })).toEqual({ "stroke-width": "2" });
  });

  it("refuses an import and any reference to a place outside the file", () => {
    expect(() => parseCss('@import url("https://x/y.css"); .a{fill:red}')).toThrow(REFUSALS.external);
    expect(() => parseCss(".a{fill:url(http://x/y)}")).toThrow(REFUSALS.external);
    expect(() => parseCss(".a{fill:url(#ok)}")).not.toThrow();
  });

  it("stops at too many rules", () => {
    expect(() => parseCss(Array.from({ length: 5001 }, (_, i) => `.c${i}{fill:red}`).join(""))).toThrow(REFUSALS.tooComplex);
  });
});

describe("parseDeclarations", () => {
  it("reads name: value pairs and ignores what is not one", () => {
    expect(parseDeclarations("fill: red; ;bad; STROKE : blue ;x:;Y Z:1;opacity:.5 !important")).toEqual({ fill: "red", stroke: "blue", opacity: ".5" });
  });
});

describe("styles", () => {
  it("takes presentation attributes, then rules, then the style attribute", () => {
    const rules = parseCss(".a{fill:green;stroke:black}").rules;
    const declared = declaredFor({ name: "path", attrs: { fill: "red", class: "a", style: "stroke: blue; color: navy", bogus: "1", transform: "scale(2)" } }, rules);
    expect(declared).toMatchObject({ fill: "green", stroke: "blue", color: "navy", transform: "scale(2)" });
    expect(declared).not.toHaveProperty("bogus");
  });

  it("inherits from the parent unless told otherwise", () => {
    const child = inheritFrom(ROOT_STYLE, { fill: "red", "stroke-width": "inherit", "fill-rule": "evenodd" });
    expect(child).toMatchObject({ fill: "red", strokeWidth: "1", fillRule: "evenodd", stroke: "none" });
    const grand = inheritFrom(child, { stroke: "blue", "stroke-linecap": "round", "stroke-linejoin": "bevel", "stroke-miterlimit": "2", "stroke-dasharray": "1 2", visibility: "hidden", "fill-opacity": ".5", "stroke-opacity": ".4", color: "red" });
    expect(grand).toMatchObject({ fill: "red", stroke: "blue", cap: "round", join: "bevel", miterLimit: "2", dash: "1 2", visibility: "hidden", fillOpacity: ".5", strokeOpacity: ".4", color: "red" });
  });
});

describe("values", () => {
  it("converts lengths to CSS pixels", () => {
    expect(parseLength("10")).toBe(10);
    expect(parseLength("1in")).toBe(96);
    expect(parseLength("25.4mm")).toBeCloseTo(96, 5);
    expect(parseLength("72pt")).toBeCloseTo(96, 5);
    expect(parseLength("50%", 200)).toBe(100);
    expect(parseLength("2.54cm")).toBeCloseTo(96, 5);
    expect(parseLength("1pc")).toBe(16);
    expect(parseLength("1em")).toBe(16);
    expect(parseLength("ten")).toBeNull();
    expect(parseLength(undefined)).toBeNull();
  });

  it("reads numbers and shares", () => {
    expect(parseNumber("3", 0)).toBe(3);
    expect(parseNumber("x", 7)).toBe(7);
    expect(parseNumber(undefined, 7)).toBe(7);
    expect(parseShare("50%", 0)).toBe(0.5);
    expect(parseShare("0.25", 0)).toBe(0.25);
    expect(parseShare("2", 0)).toBe(1);
    expect(parseShare("x", 0.3)).toBe(0.3);
    expect(parseShare(undefined, 0.3)).toBe(0.3);
  });

  it("reads paints, with currentColor, references and fallbacks", () => {
    expect(parsePaint("none", "black")).toEqual({ kind: "none" });
    expect(parsePaint("#f00", "black")).toEqual({ kind: "colour", hex: "#ff0000", alpha: 1 });
    expect(parsePaint("currentColor", "navy")).toEqual({ kind: "colour", hex: "#000080", alpha: 1 });
    expect(parsePaint("url(#g1) red", "black")).toEqual({ kind: "ref", id: "g1", fallback: { kind: "colour", hex: "#ff0000", alpha: 1 } });
    expect(parsePaint("url('#g1')", "black")).toEqual({ kind: "ref", id: "g1", fallback: { kind: "none" } });
    expect(parsePaint("nonsense", "black")).toEqual({ kind: "none" });
  });

  it("reads dash lists", () => {
    expect(parseDashes("4 2")).toEqual([4, 2]);
    expect(parseDashes("none")).toBeUndefined();
    expect(parseDashes("0 0")).toBeUndefined();
    expect(parseDashes("a b")).toBeUndefined();
    expect(parseDashes("1,-1")).toBeUndefined();
    expect(parseDashes("1 ".repeat(20))).toBeUndefined();
  });
});
