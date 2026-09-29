import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseCm } from "./cm";

describe("parseCm", () => {
  it("turns 52.5 cm into exactly 5250 tenths of a millimetre", () => {
    expect(parseCm("52.5")).toEqual({ ok: true, tenthsMm: 5250 });
  });

  it("turns whole numbers, two decimals and padded zeros into exact values", () => {
    expect(parseCm("52")).toEqual({ ok: true, tenthsMm: 5200 });
    expect(parseCm("0.01")).toEqual({ ok: true, tenthsMm: 1 });
    expect(parseCm("52.50")).toEqual({ ok: true, tenthsMm: 5250 });
    expect(parseCm("52.500")).toEqual({ ok: true, tenthsMm: 5250 });
    expect(parseCm("  7.05 ")).toEqual({ ok: true, tenthsMm: 705 });
  });

  it("gives the same answer as hand arithmetic for every whole and two decimal input", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 30_000 }), (tenths) => {
        const text = `${Math.floor(tenths / 100)}.${String(tenths % 100).padStart(2, "0")}`;
        expect(parseCm(text)).toEqual({ ok: true, tenthsMm: tenths });
      }),
    );
  });

  it("says an empty cell is empty", () => {
    expect(parseCm("")).toEqual({ ok: false, reason: "empty" });
    expect(parseCm("   ")).toEqual({ ok: false, reason: "empty" });
  });

  it("says a leading minus on a number is a negative number", () => {
    expect(parseCm("-5")).toEqual({ ok: false, reason: "negative" });
    expect(parseCm("-0.5")).toEqual({ ok: false, reason: "negative" });
  });

  it("treats cells that start with a formula character as text", () => {
    for (const cell of ["=1+2", "+5", "@SUM(A1)", "-", "-5+3", "=cmd|' /C calc'!A0"]) {
      expect(parseCm(cell)).toEqual({ ok: false, reason: "formula" });
    }
  });

  it("refuses text that is not a plain number", () => {
    for (const cell of ["abc", "52,5", "5 2", "1e3", ".5", "5.", "0x10", "٣"]) {
      expect(parseCm(cell)).toEqual({ ok: false, reason: "not-a-number" });
    }
  });

  it("refuses more precision than a tenth of a millimetre", () => {
    expect(parseCm("52.505")).toEqual({ ok: false, reason: "too-precise" });
    expect(parseCm("0.001")).toEqual({ ok: false, reason: "too-precise" });
  });

  it("refuses numbers too large to be a length", () => {
    expect(parseCm("99999999999999999999")).toEqual({ ok: false, reason: "too-large" });
    expect(parseCm("301")).toEqual({ ok: false, reason: "too-large" });
    expect(parseCm("300")).toEqual({ ok: true, tenthsMm: 30_000 });
  });
});
