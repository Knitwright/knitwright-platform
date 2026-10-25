import { describe, expect, it } from "vitest";
import { formatInput, parseInput } from "./input";
import { findSetting } from "./registry";

const def = (key: string) => findSetting(key)!;

describe("parseInput", () => {
  it("reads a whole number and says why a bad one is refused", () => {
    expect(parseInput(def("guardrails.min_dpi"), " 200 ")).toEqual({ ok: true, value: 200 });
    expect(parseInput(def("guardrails.min_dpi"), "")).toMatchObject({ ok: false });
    expect(parseInput(def("guardrails.min_dpi"), "abc")).toMatchObject({ ok: false });
    expect(parseInput(def("guardrails.min_dpi"), "10")).toEqual({ ok: false, message: "Use 30 or more." });
    expect(parseInput(def("guardrails.min_dpi"), "150.5")).toEqual({ ok: false, message: "Whole numbers only." });
  });

  it("reads an optional number, empty meaning not set", () => {
    expect(parseInput(def("ops.lead_time_days"), "")).toEqual({ ok: true, value: null });
    expect(parseInput(def("ops.lead_time_days"), "21")).toEqual({ ok: true, value: 21 });
  });

  it("reads a time as minutes after midnight", () => {
    expect(parseInput(def("ops.cutoff_minutes"), "07:30")).toEqual({ ok: true, value: 450 });
    expect(parseInput(def("ops.cutoff_minutes"), "25:00")).toEqual({ ok: false, message: "Give the time as hours and minutes, such as 07:00." });
  });

  it("reads a list", () => {
    expect(parseInput(def("factory.file_formats"), "pdf, dxf ,,png")).toEqual({ ok: true, value: ["pdf", "dxf", "png"] });
  });

  it("reads article lines", () => {
    expect(parseInput(def("factory.moq_by_article"), "crew-tee = 10\n\npolo = 20")).toEqual({ ok: true, value: { "crew-tee": 10, polo: 20 } });
    expect(parseInput(def("factory.hs_codes"), "crew-tee = 6109.10")).toEqual({ ok: true, value: { "crew-tee": "6109.10" } });
    expect(parseInput(def("factory.moq_by_article"), "crew-tee 10")).toMatchObject({ ok: false, message: expect.stringContaining("crew-tee 10") });
    expect(parseInput(def("factory.moq_by_article"), "crew-tee = ten")).toMatchObject({ ok: false });
  });

  it("reads a price ladder", () => {
    expect(parseInput(def("factory.price_ladder"), "10 = 32.5\n50 = 28")).toEqual({
      ok: true,
      value: [{ fromPieces: 10, unitPrice: 32.5 }, { fromPieces: 50, unitPrice: 28 }],
    });
    expect(parseInput(def("factory.price_ladder"), "")).toMatchObject({ ok: false });
  });
});

describe("formatInput", () => {
  it("is the inverse of parseInput", () => {
    const cases: [string, string][] = [
      ["ops.cutoff_minutes", "07:30"],
      ["factory.file_formats", "pdf, dxf"],
      ["factory.moq_by_article", "crew-tee = 10"],
      ["factory.price_ladder", "10 = 32.5"],
      ["guardrails.min_dpi", "200"],
      ["ops.lead_time_days", "21"],
    ];
    for (const [key, text] of cases) {
      const parsed = parseInput(def(key), text);
      expect(parsed.ok && formatInput(def(key), parsed.value), key).toBe(text);
    }
  });

  it("shows nothing for 'not set'", () => {
    expect(formatInput(def("ops.lead_time_days"), null)).toBe("");
    expect(formatInput(def("ops.lead_time_days"), undefined)).toBe("");
  });
});
