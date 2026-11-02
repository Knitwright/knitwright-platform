import { describe, expect, it } from "vitest";
import { SAMPLE_MAX_SIZES } from "@/lib/make/vocabulary";
import { sampleFindings, sampleSizesOf, samplesForApproved } from "./samples";
import { ids, plan, style } from "./fixtures/plan";

/**
 * Decision 0085: "Order samples for all approved styles" (spec F-S10) goes through the make flow's one
 * door (plan v5 Y7). This file decides which styles go and with which sizes; the database checks the
 * same two rules again. A style that cannot be sampled is reported with the rule behind it, never
 * silently dropped.
 */

describe("samplesForApproved", () => {
  it("takes the approved styles only", () => {
    const { targets } = samplesForApproved(plan());
    expect(targets.map((target) => target.styleId)).toEqual([ids.navy]);
  });

  it("asks for one piece per planned size, up to the sample's limit", () => {
    const { targets } = samplesForApproved(plan({ styles: [style()] }));
    expect(targets[0]).toMatchObject({ sizes: ["S", "M"], pieces: 2, productId: ids.product });
  });

  it("trims a long size run to the first sizes a sample may carry", () => {
    const many = style({ sizes: ["XS", "S", "M", "L", "XL"].map((label) => ({ label, qty: 5 })) });
    expect(sampleSizesOf(many)).toHaveLength(SAMPLE_MAX_SIZES);
    expect(sampleFindings(plan({ styles: [many] })).map((found) => found.code)).toEqual(["sample_sizes_trimmed"]);
  });

  it("says how many styles had their size run trimmed", () => {
    const many = (id: string) => style({ id, sizes: ["XS", "S", "M", "L"].map((label) => ({ label, qty: 2 })) });
    const findings = sampleFindings(plan({ styles: [many(ids.navy), many(ids.white)] }));
    expect(findings[0]!.message).toContain("2 styles ask");
  });

  it("leaves out a size with no pieces planned", () => {
    expect(sampleSizesOf(style({ sizes: [{ label: "S", qty: 0 }, { label: "M", qty: 3 }] }))).toEqual(["M"]);
  });

  it("skips an approved style that is not listed as a product, with the reason", () => {
    const one = plan({ styles: [style({ productId: null, projectId: null })] });
    const { targets, skipped, canOrder } = samplesForApproved(one);
    expect([targets, canOrder]).toEqual([[], false]);
    expect(skipped[0]!.finding).toMatchObject({ code: "sample_no_product", severity: "blocker", ruleId: "R-GAP-000" });
  });

  it("skips an approved style with nothing planned", () => {
    const one = plan({ styles: [style({ sizes: [] })] });
    expect(samplesForApproved(one).skipped[0]!.finding.code).toBe("sample_no_sizes");
  });

  it("says what would be ordered under the button", () => {
    expect(samplesForApproved(plan()).summary).toBe("1 of 2 approved styles · one piece per size · 2 pieces.");
    expect(samplesForApproved(plan({ styles: [style()] })).summary).toBe("1 of 1 approved style · one piece per size · 2 pieces.");
    expect(samplesForApproved(plan({ styles: [style({ status: "draft" })] })).summary).toBe("No style in this plan is approved yet.");
    expect(samplesForApproved(plan({ styles: [style({ productId: null })] })).summary).toBe("No approved style can be sampled yet.");
  });

  it("can order when at least one approved style is ready", () => {
    expect(samplesForApproved(plan()).canOrder).toBe(true);
  });
});
