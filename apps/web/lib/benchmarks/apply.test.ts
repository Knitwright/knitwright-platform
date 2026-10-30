import { describe, expect, it } from "vitest";
import { catalogue } from "@/lib/catalogue/fixtures/source";
import type { BaseArticle } from "@/lib/catalogue";
import { applyPlan, NEVER_CARRIED, NOT_AVAILABLE } from "./apply";
import { card, runningShort } from "./fixtures/cards";

/**
 * "Apply to my design" (spec F-S2 step 6) and the guardrail that matters most here (F-G1): a logo, a brand name and a
 * print are never carried over. The first test is the one the plan asks for in so many words.
 */

const jersey = (): BaseArticle => {
  const found = catalogue().find((article) => article.code === "JSY-SS-01");
  if (found === undefined) throw new Error("The worked article is missing from the catalogue.");
  return found;
};

describe("nothing of the competitor's brand crosses over", () => {
  it("carries no logo, brand name, product name, claim or print into the plan", () => {
    const plan = applyPlan(runningShort(), jersey());
    const written = JSON.stringify(plan);
    for (const word of ["Acme", "Speedshort", "Squat-proof", "all_over_print", "brand_logo", "brand_name"]) {
      expect(written).not.toContain(word);
    }
    // And it says plainly what is left behind, as kinds of thing rather than as their words.
    expect(plan.neverCarried).toEqual(NEVER_CARRIED);
    expect(plan.neverCarried.map((item) => item.label)).toContain("Logo or brand mark");
  });

  it("considers only functional features, so a decorative or graphic one is never mapped", () => {
    const withGraphics = card({
      features: [
        { key: "all_over_print", provenance: "observed" },
        { key: "stripes", provenance: "observed" },
        { key: "brand_logo", provenance: "observed" },
        { key: "drop_tail", provenance: "observed" },
      ],
    });
    const plan = applyPlan(withGraphics, jersey());
    expect(plan.mapped.map((item) => item.featureKey)).toEqual(["drop_tail"]);
    expect(plan.unsupported).toEqual([]);
  });
});

describe("mapping onto the base article's own rows", () => {
  it("maps a feature that is a parameter to that parameter's approved range, with its rule", () => {
    const plan = applyPlan(card({ features: [{ key: "drop_tail", provenance: "observed" }] }), jersey());
    expect(plan.mapped[0]).toMatchObject({
      featureKey: "drop_tail",
      target: { kind: "parameter", key: "back_drop_tail", min: 0, max: 40 },
      ruleId: "R-PAT-005",
    });
  });

  it("maps a feature that is an option to the option in its own group, with its catalogue code", () => {
    const plan = applyPlan(card({ features: [{ key: "crew_neck", provenance: "observed" }] }), jersey());
    expect(plan.mapped[0]?.target).toEqual({ kind: "option", group: "collar", code: "C01", label: "Crew neck, 1x1 rib, 20 mm finished" });
    expect(plan.mapped[0]?.ruleId).toBe("R-CON-004");
  });

  it("lists what the base cannot do instead of bending the base", () => {
    const plan = applyPlan(
      card({
        features: [
          { key: "half_zip", provenance: "observed" },
          { key: "inseam_length", provenance: "observed" },
          { key: "mesh_venting", provenance: "inferred" },
        ],
      }),
      jersey(),
    );
    expect(plan.mapped).toEqual([]);
    expect(plan.unsupported.map((item) => item.featureKey).sort()).toEqual(["half_zip", "inseam_length", "mesh_venting"]);
    expect(plan.unsupported[0]?.message).toBe(NOT_AVAILABLE);
    // Every finding carries a rule id, even where the rulebook has nothing yet.
    expect(plan.unsupported.every((item) => /^R-[A-Z]{2,5}-\d{3}$/.test(item.ruleId))).toBe(true);
    expect(plan.mapped.every((item) => /^R-[A-Z]{2,5}-\d{3}$/.test(item.ruleId))).toBe(true);
  });

  it("maps only the features the person ticked", () => {
    const plan = applyPlan(runningShort(), jersey(), ["drawcord"]);
    expect(plan.mapped).toEqual([]);
    expect(plan.unsupported.map((item) => item.featureKey)).toEqual(["drawcord"]);
  });

  it("names the article it mapped against", () => {
    expect(applyPlan(runningShort(), jersey()).articleCode).toBe("JSY-SS-01");
  });
});
