import { describe, expect, it } from "vitest";
import { checkSampleRequest, describeSample } from "./sample";
import { SAMPLE_MAX_SIZES } from "./vocabulary";

const request = (sizes: readonly string[], sizeRun: readonly string[] = ["S", "M", "L", "XL"]) => checkSampleRequest({ sizes, sizeRun });

describe("a sample request", () => {
  it("is one piece of each size chosen", () => {
    const check = request(["S", "M"]);
    expect(check.sizes).toEqual({ S: 1, M: 1 });
    expect(check.pieces).toBe(2);
    expect(check.canSend).toBe(true);
    expect(check.findings).toEqual([]);
  });

  it("takes at most three sizes", () => {
    const check = request(["S", "M", "L", "XL"]);
    expect(check.canSend).toBe(false);
    expect(check.sizes).toEqual({});
    expect(check.findings.map((f) => f.code)).toEqual(["sample_sizes"]);
    expect(check.findings[0]?.message).toContain(String(SAMPLE_MAX_SIZES));
  });

  it("needs a size", () => {
    expect(request([]).findings.map((f) => f.code)).toEqual(["sample_no_size"]);
    expect(request(["  "]).canSend).toBe(false);
  });

  it("counts a size chosen twice once", () => {
    const check = request(["M", "M", "L"]);
    expect(check.sizes).toEqual({ M: 1, L: 1 });
    expect(check.pieces).toBe(2);
  });

  it("refuses a size the design's size run does not have", () => {
    const check = request(["XXL"]);
    expect(check.findings.map((f) => f.code)).toEqual(["sample_size_unknown"]);
    expect(check.findings[0]?.message).toContain("XXL");
  });

  it("accepts any size label when the design has no size run", () => {
    expect(request(["One size"], []).sizes).toEqual({ "One size": 1 });
  });

  it("explains every finding with a rule", () => {
    expect(request([]).findings.every((f) => /^R-[A-Z]+-\d{3}$/.test(f.ruleId))).toBe(true);
  });

  it("is described in words, before and after sizes are chosen", () => {
    expect(describeSample(request([]))).toContain(String(SAMPLE_MAX_SIZES));
    expect(describeSample(request(["M"]))).toBe("M · one piece each · 1 piece.");
    expect(describeSample(request(["M", "L"]))).toContain("2 pieces");
  });
});
