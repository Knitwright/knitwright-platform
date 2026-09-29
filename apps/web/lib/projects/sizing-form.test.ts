import { describe, expect, it } from "vitest";
import { parseSizeLabels, sizesText, sizingActionFromForm } from "./sizing-form";

describe("parseSizeLabels", () => {
  it("splits on commas and trims each label", () => {
    expect(parseSizeLabels(" S, M ,L ")).toEqual(["S", "M", "L"]);
  });

  it("ignores empty pieces", () => {
    expect(parseSizeLabels("S,, M, ,")).toEqual(["S", "M"]);
    expect(parseSizeLabels("   ")).toEqual([]);
    expect(parseSizeLabels("")).toEqual([]);
  });
});

describe("sizesText", () => {
  it("writes the sizes as the person would type them", () => {
    expect(sizesText({ sizes: ["S", "M", "L"], baseSize: "M" })).toBe("S, M, L");
    expect(sizesText(null)).toBe("");
  });
});

describe("sizingActionFromForm", () => {
  it("makes a set-sizing action from a list and a base size", () => {
    expect(sizingActionFromForm("S, M, L", "M")).toEqual({
      ok: true,
      action: { type: "set-sizing", sizing: { sizes: ["S", "M", "L"], baseSize: "M" } },
    });
  });

  it("asks for at least one size", () => {
    expect(sizingActionFromForm("  ,  ", "M")).toEqual({
      ok: false,
      errors: { sizes: "Add at least one size." },
    });
  });

  it("refuses a size that appears twice", () => {
    const result = sizingActionFromForm("S, M, M", "S");

    expect(result).toEqual({ ok: false, errors: { sizes: "Each size can appear only once." } });
  });

  it("asks for a base size that is one of the sizes", () => {
    expect(sizingActionFromForm("S, M, L", "XL")).toEqual({
      ok: false,
      errors: { baseSize: "The base size must be one of the sizes." },
    });
    expect(sizingActionFromForm("S, M, L", "")).toEqual({
      ok: false,
      errors: { baseSize: "Choose the base size." },
    });
  });

  it("refuses a label that is too long, and says how long it may be", () => {
    const result = sizingActionFromForm("S, ABCDEFGHIJKLM", "S");

    expect(result).toEqual({ ok: false, errors: { sizes: "Use 12 characters or fewer." } });
  });

  it("refuses a run that is too long, and says how many sizes are allowed", () => {
    const many = Array.from({ length: 25 }, (_, index) => `S${index}`).join(",");

    expect(sizingActionFromForm(many, "S0")).toEqual({
      ok: false,
      errors: { sizes: "Use 24 sizes or fewer." },
    });
  });

  it("keeps both problems when the list and the base size are both wrong", () => {
    const result = sizingActionFromForm("", "");

    expect(result).toEqual({
      ok: false,
      errors: { sizes: "Add at least one size.", baseSize: "Choose the base size." },
    });
  });
});
