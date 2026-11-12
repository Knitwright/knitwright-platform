import { describe, expect, it } from "vitest";
import { ALL_RULES } from "@/lib/validation/rules";
import { fixHref, ruleOf } from "./fix";

/** Plan v6 D1 (decision 0132): every failing check has a "Fix" link where a screen of the brand's can fix it. */

const ID = "11111111-1111-4111-8111-111111111111";

describe("where a finding is fixed", () => {
  it("sends a tech pack line to the tech pack", () => {
    expect(fixHref(ID, "readiness-fabric-test")).toBe(`/studio/${ID}/tech-pack`);
  });

  it("sends artwork and content findings to the logos tool", () => {
    for (const code of ["seam-cross", "min-dpi", "bleed-short", "safe-zone", "moderation-blocked", "repeat-min-dpi"]) {
      expect(fixHref(ID, code), code).toBe(`/studio/${ID}?tool=logos`);
    }
  });

  it("sends colour to the colours tool and the article's parameters to the garment tool", () => {
    expect(fixHref(ID, "gamut-approx")).toBe(`/studio/${ID}?tool=colours`);
    expect(fixHref(ID, "parameter-out-of-range")).toBe(`/studio/${ID}?tool=garment`);
    expect(fixHref(ID, "article-not-made")).toBe(`/studio/${ID}?tool=garment`);
  });

  it("offers no link for a term only the factory or Knitwright can set", () => {
    for (const code of ["moq-not-set", "lead-time-not-set", "price-ladder-not-set", "check-failed", "not-a-code"]) {
      expect(fixHref(ID, code), code).toBeNull();
    }
  });

  it("has a decision for every code a check can produce", () => {
    const decided = Object.keys(ALL_RULES).filter((code) => fixHref(ID, code) !== null || ["moq-not-set", "lead-time-not-set", "price-ladder-not-set", "check-failed"].includes(code));
    expect(decided).toEqual(Object.keys(ALL_RULES));
  });
});

describe("the rule behind a finding", () => {
  it("is its own where it carries one, else its code's", () => {
    expect(ruleOf({ code: "seam-cross", ruleId: "R-PAT-001" })).toBe("R-PAT-001");
    expect(ruleOf({ code: "seam-cross" })).toBe("R-SUB-004");
    expect(ruleOf({ code: "unknown" })).toBe("R-GAP-000");
  });
});
