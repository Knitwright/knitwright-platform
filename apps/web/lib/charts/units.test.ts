import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { formatLength } from "@/lib/units/length";
import { parseInches, readChartUnit, readLength } from "./units";

describe("readChartUnit", () => {
  it.each([
    ["cm", "cm"],
    ["CM", "cm"],
    [" cms ", "cm"],
    ["centimetres", "cm"],
    ["Centimeter", "cm"],
    ["in", "in"],
    ["IN.", "in"],
    ["inch", "in"],
    ["Inches", "in"],
    ['"', "in"],
    ["″", "in"],
  ])("reads %j as %s", (cell, unit) => {
    expect(readChartUnit(cell)).toEqual({ ok: true, unit });
  });

  it("reads an empty cell as no unit, so the choice on the screen applies", () => {
    expect(readChartUnit("  ")).toEqual({ ok: true, unit: null });
  });

  it.each(["mm", "m", "ft", "feet", "yd", "px", "in cm", "c m", "=cm"])("refuses the unknown unit %j", (cell) => {
    expect(readChartUnit(cell)).toEqual({ ok: false });
  });
});

describe("parseInches", () => {
  it("stores inches as tenths of a millimetre: 1 inch is 254", () => {
    expect(parseInches("1")).toEqual({ ok: true, tenthsMm: 254 });
    expect(parseInches("20")).toEqual({ ok: true, tenthsMm: 5080 });
    expect(parseInches("20.5")).toEqual({ ok: true, tenthsMm: 5207 });
  });

  it("reads fractions as a tape measure writes them", () => {
    expect(parseInches("20 1/2")).toEqual({ ok: true, tenthsMm: 5207 });
    expect(parseInches("1/4")).toEqual({ ok: true, tenthsMm: Math.round(254 / 4) });
    expect(parseInches("3 3/8")).toEqual({ ok: true, tenthsMm: Math.round(254 * 3.375) });
    expect(parseInches("20½")).toEqual({ ok: true, tenthsMm: 5207 });
    expect(parseInches("20 ¾")).toEqual({ ok: true, tenthsMm: Math.round(254 * 20.75) });
  });

  it("rounds to the nearest tenth of a millimetre", () => {
    // 1/16 inch is 15.875 tenths of a millimetre.
    expect(parseInches("1/16")).toEqual({ ok: true, tenthsMm: 16 });
    expect(parseInches("0.125")).toEqual({ ok: true, tenthsMm: 32 });
  });

  it("refuses what it cannot read exactly, and never works out a formula", () => {
    expect(parseInches("")).toEqual({ ok: false, reason: "empty" });
    expect(parseInches("-2")).toEqual({ ok: false, reason: "negative" });
    expect(parseInches("=A1*2")).toEqual({ ok: false, reason: "formula" });
    expect(parseInches("twenty")).toEqual({ ok: false, reason: "not-a-number" });
    expect(parseInches("20 1/3")).toEqual({ ok: false, reason: "not-a-number" });
    expect(parseInches("20 3/2")).toEqual({ ok: false, reason: "not-a-number" });
    expect(parseInches("1/0")).toEqual({ ok: false, reason: "not-a-number" });
    expect(parseInches("20.1234")).toEqual({ ok: false, reason: "too-precise" });
    expect(parseInches("99999")).toEqual({ ok: false, reason: "too-large" });
  });

  it("goes there and back: any length to the eighth of an inch reads back as the same inches", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 * 8 }), (eighths) => {
        const whole = Math.floor(eighths / 8);
        const part = eighths % 8;
        const typed = part === 0 ? `${whole}` : `${whole === 0 ? "" : `${whole} `}${part}/8`;
        const read = parseInches(typed);
        if (!read.ok) throw new Error(`${typed} was not read`);
        const cm = read.tenthsMm / 100;
        expect(Math.round((cm / 2.54) * 8)).toBe(eighths);
        expect(formatLength(cm, "in")).toBe(formatLength((eighths / 8) * 2.54, "in"));
      }),
    );
  });
});

describe("readLength", () => {
  it("reads centimetres exactly as before, and inches through parseInches", () => {
    expect(readLength("52.5", "cm")).toEqual({ ok: true, tenthsMm: 5250 });
    expect(readLength("20 1/2", "in")).toEqual({ ok: true, tenthsMm: 5207 });
    expect(readLength("20 1/2", "cm")).toEqual({ ok: false, reason: "not-a-number" });
  });
});
