import { describe, expect, it } from "vitest";
import { designAround, LAYOUT_WARN_AT, SILHOUETTE_WARN_AT, type DesignShape } from "./design-around";
import { card, runningShort } from "./fixtures/cards";
import { RULE_GAP } from "./vocabulary";

/**
 * The design-around check (spec F-S2 guardrails, F-G1): it warns on a close silhouette or a close surface layout, and
 * it never says a design is safe or unsafe.
 */

const design = (parts: Partial<DesignShape> = {}): DesignShape => ({ features: [], layout: [], ...parts });

describe("designAround", () => {
  it("says far when a design shares almost nothing with the benchmark", () => {
    const report = designAround(design({ features: ["drawcord"] }), runningShort());

    expect(report).toMatchObject({ closeness: "far", findings: [], silhouetteShared: 1 });
  });

  it("warns once three silhouette choices are the same, and names what they are in our own words", () => {
    const report = designAround(design({ features: ["zip_back_pocket", "bonded_hem", "liner", "drawcord"] }), runningShort());
    const finding = report.findings.find((found) => found.code === "silhouette_close");

    expect(report.closeness).toBe("close");
    expect(report.silhouetteShared).toBe(4);
    expect(finding?.shared).toEqual(["Zip back pocket", "Bonded hem", "Inner liner", "Drawcord"]);
    expect(finding?.severity).toBe("warn");
  });

  it("starts warning at the number the file says it does, and not before", () => {
    const three = ["zip_back_pocket", "bonded_hem", "liner"].slice(0, SILHOUETTE_WARN_AT);
    const under = designAround(design({ features: three.slice(0, SILHOUETTE_WARN_AT - 1) }), runningShort());
    const at = designAround(design({ features: three }), runningShort());

    expect(under.findings.map((found) => found.code)).toEqual([]);
    expect(at.findings.map((found) => found.code)).toEqual(["silhouette_close"]);
  });

  it("warns when the artwork sits in the same places as the benchmark's, and says to move one", () => {
    const sameLayout = design({
      layout: [
        { zone: "left_chest", kind: "mark" },
        { zone: "side_panel", kind: "block" },
        { zone: "hem", kind: "stripe" },
      ],
    });
    const report = designAround(sameLayout, runningShort());
    const finding = report.findings.find((found) => found.code === "layout_close");

    expect(report.layoutShared).toBe(LAYOUT_WARN_AT);
    expect(finding?.message).toContain("Move or drop one");
    expect(finding?.shared).toEqual(["left_chest:mark", "side_panel:block", "hem:stripe"]);
  });

  it("does not warn on a layout that shares three places out of many: the share matters too", () => {
    const wide = card({
      surfaceLayout: [
        { zone: "left_chest", kind: "mark", provenance: "inferred" },
        { zone: "side_panel", kind: "block", provenance: "inferred" },
        { zone: "hem", kind: "stripe", provenance: "inferred" },
        { zone: "sleeve", kind: "stripe", provenance: "inferred" },
        { zone: "back", kind: "text", provenance: "inferred" },
      ],
    });
    const report = designAround(
      design({ layout: [{ zone: "left_chest", kind: "mark" }, { zone: "side_panel", kind: "block" }, { zone: "hem", kind: "stripe" }] }),
      wide,
    );

    expect(report.findings.map((found) => found.code)).toEqual([]);
  });

  it("ignores a benchmark's decorative and graphic features: only the silhouette is compared", () => {
    const graphics = card({
      features: [
        { key: "brand_logo", provenance: "observed" },
        { key: "all_over_print", provenance: "observed" },
        { key: "stripes", provenance: "observed" },
      ],
    });
    const report = designAround(design({ features: ["brand_logo", "all_over_print", "stripes"] }), graphics);

    expect(report).toMatchObject({ closeness: "far", silhouetteShared: 0 });
  });

  it("carries a rule id on every finding, the gap id until the rulebook has an entry", () => {
    const report = designAround(design({ features: ["zip_back_pocket", "bonded_hem", "liner"] }), runningShort());

    expect(report.findings.every((found) => found.ruleId === RULE_GAP)).toBe(true);
  });

  it("never says a design is safe, cleared or infringing", () => {
    const report = designAround(design({ features: ["zip_back_pocket", "bonded_hem", "liner"] }), runningShort());
    const words = JSON.stringify(report).toLowerCase();

    for (const claim of ["safe", "cleared", "infring", "copyright", "legal"]) expect(words, claim).not.toContain(claim);
  });
});
