import { describe, expect, it } from "vitest";
import { cmText, parseCmInput } from "./measurement-input";

describe("cmText", () => {
  it.each([
    [5250, "52.5"],
    [3000, "30"],
    [5255, "52.55"],
    [1, "0.01"],
    [30000, "300"],
  ])("writes %i tenths of a millimetre as %s centimetres", (tenths, text) => {
    expect(cmText(tenths)).toBe(text);
  });
});

describe("parseCmInput", () => {
  it.each([
    ["52.5", 5250],
    ["52,5", 5250],
    [" 52.55 ", 5255],
    ["52", 5200],
    ["0.01", 1],
    ["300", 30000],
    ["7.", 700],
  ])("reads %j as %i", (text, tenths) => {
    expect(parseCmInput(text)).toEqual({ ok: true, tenths });
  });

  it("reads exactly, so a value with a fraction never drifts", () => {
    expect(parseCmInput("0.29")).toEqual({ ok: true, tenths: 29 });
    expect(parseCmInput("1.15")).toEqual({ ok: true, tenths: 115 });
  });

  it.each(["", "   ", "abc", "5 2", "-3", "1e3", "52.555", "0", "0.00", "300.01", "12cm", "--", "."])(
    "refuses %j with a plain sentence",
    (text) => {
      const result = parseCmInput(text);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/^Enter /);
    },
  );

  it("round trips with cmText", () => {
    for (const tenths of [1, 99, 5250, 5255, 29999, 30000]) {
      expect(parseCmInput(cmText(tenths))).toEqual({ ok: true, tenths });
    }
  });
});
