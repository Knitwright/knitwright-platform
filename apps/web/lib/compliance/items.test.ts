import { describe, expect, it } from "vitest";
import { itemOf, preExportCheck } from "./checklist";
import { fixtureSubject } from "./fixtures/rows";
import { classBReviewFinding, requiresHumanReview } from "./items";
import type { ChecklistItemId } from "./model";
import type { PreExportSubject } from "./subject";

/** The findings of one item, for a subject built to break exactly that item. */
const codes = (id: ChecklistItemId, over: Partial<PreExportSubject>): readonly string[] =>
  (itemOf(preExportCheck(fixtureSubject(over)), id)?.findings ?? []).map((found) => found.code);

describe("every field filled in", () => {
  it("names each field that still needs input, with the rule on its row", () => {
    const found = itemOf(preExportCheck(fixtureSubject({ needsInput: [{ path: "fields.season", label: "Season", ruleId: "R-SUB-001" }] })), "needs_input");
    expect(found?.findings[0]).toMatchObject({ path: "fields.season", message: "Season: needs your input.", ruleId: "R-SUB-001" });
  });
});

describe("no [TBC] anywhere", () => {
  it("names the path that holds one", () => {
    const found = itemOf(preExportCheck(fixtureSubject({ tbcPaths: ["bom[0].spec"] })), "tbc");
    expect(found?.findings[0]?.message).toBe("bom[0].spec holds [TBC], which may not go to a factory.");
  });
});

describe("points of measure complete", () => {
  it("refuses a document with none at all", () => {
    expect(codes("poms", { poms: [] })).toEqual(["poms_none"]);
  });

  it("names a missing value, a missing tolerance and a field still needing input", () => {
    expect(
      codes("poms", {
        poms: [{ letter: "A", description: "Chest width", missingSizes: ["M", "L"], hasTolerance: false, needsInput: true, ruleId: "R-FIT-001" }],
      }),
    ).toEqual(["pom_needs_input", "pom_no_value", "pom_no_tolerance"]);
  });

  it("lists the sizes it has no value for", () => {
    const found = itemOf(
      preExportCheck(fixtureSubject({ poms: [{ letter: "A", description: "Chest width", missingSizes: ["M", "L"], hasTolerance: true, needsInput: false, ruleId: "R-FIT-001" }] })),
      "poms",
    );
    expect(found?.findings[0]?.message).toBe("POM A Chest width: no value for M and L.");
  });
});

describe("bill of materials complete", () => {
  it("refuses no lines, and refuses lines with no fabric among them", () => {
    expect(codes("bom", { bom: [] })).toEqual(["bom_none"]);
    expect(codes("bom", { bom: [{ item: "Thread", kind: "thread", gaps: [], ruleId: "R-CON-009" }] })).toEqual(["bom_no_fabric"]);
  });

  it("names what is missing from a line", () => {
    const found = itemOf(
      preExportCheck(fixtureSubject({ bom: [{ item: "Main fabric", kind: "fabric", gaps: ["no quantity", "no unit"], ruleId: "R-SUB-001" }] })),
      "bom",
    );
    expect(found?.findings[0]?.message).toBe("BOM Main fabric: no quantity and no unit.");
  });
});

describe("labels for every destination market", () => {
  it("refuses a design with no destination chosen", () => {
    expect(codes("labels", { labels: [] })).toEqual(["labels_none"]);
  });
});

describe("colours", () => {
  it("refuses a design whose colours nobody named, rather than passing it over", () => {
    const found = itemOf(preExportCheck(fixtureSubject({ colour: { fabric: "F-POLY-INT", roles: [], toleranceMax: 1.5, ruleId: "R-SUB-005" } })), "colour_gamut");
    expect(found?.status).toBe("fail");
    expect(found?.findings.map((one) => one.code)).toEqual(["colour_no_roles"]);
  });

  it("refuses a colour spec with no fabric and no agreed colour difference", () => {
    expect(
      codes("colour_gamut", {
        colour: { fabric: null, roles: [{ role: "primary", hex: "#0B1F4B", pantoneTcx: "19-4024 TCX", swatchId: "SB-1" }], toleranceMax: null, ruleId: "R-SUB-005" },
      }),
    ).toEqual(["colour_no_fabric", "colour_no_tolerance"]);
  });

  it("names the fabric, the roles and the colour difference together when all three are missing", () => {
    expect(codes("colour_gamut", { colour: { fabric: null, roles: [], toleranceMax: null, ruleId: "R-SUB-005" } })).toEqual([
      "colour_no_fabric",
      "colour_no_roles",
      "colour_no_tolerance",
    ]);
  });

  it("names a colour with no hex, no Pantone and no swatch", () => {
    const found = itemOf(
      preExportCheck(
        fixtureSubject({ colour: { fabric: "F-POLY-INT", roles: [{ role: "primary", hex: null, pantoneTcx: null, swatchId: null }], toleranceMax: 1.5, ruleId: "R-SUB-005" } }),
      ),
      "colour_gamut",
    );
    expect(found?.findings[0]?.message).toBe("Colour primary: no valid hex, no Pantone TCX and no swatch ID.");
  });

  it("treats a hex that is not a hex as no hex", () => {
    expect(
      codes("colour_gamut", {
        colour: { fabric: "F-POLY-INT", roles: [{ role: "primary", hex: "navy", pantoneTcx: "19-4024 TCX", swatchId: "SB-1" }], toleranceMax: 1.5, ruleId: "R-SUB-005" },
      }),
    ).toEqual(["colour_incomplete"]);
  });

  it("warns, and never refuses, a colour outside the gamut estimate", () => {
    const found = itemOf(
      preExportCheck(
        fixtureSubject({
          colour: { fabric: "F-POLY-INT", roles: [{ role: "primary", hex: "#FF0000", pantoneTcx: "19-1664 TCX", swatchId: "SB-2" }], toleranceMax: 1.5, ruleId: "R-SUB-005" },
        }),
      ),
      "colour_gamut",
    );
    expect(found?.status).toBe("warn");
    expect(found?.findings[0]).toMatchObject({ code: "colour_outside_gamut", severity: "warning" });
    expect(found?.findings[0]?.message).toContain("match the strike-off, not the screen");
  });
});

describe("print files", () => {
  const print = { dpi: 150, minDpi: 150, bleedMm: 10, minBleedMm: 10, ruleId: "R-SUB-002" };

  it("is not checked where the source has no print files", () => {
    expect(itemOf(preExportCheck(fixtureSubject()), "bleed")).toMatchObject({ status: "skipped", skipped: "not_in_this_source" });
  });

  it("passes files at the DPI and bleed the rules ask for", () => {
    const result = preExportCheck(fixtureSubject({ print }));
    expect(itemOf(result, "dpi")?.status).toBe("pass");
    expect(itemOf(result, "bleed")?.status).toBe("pass");
  });

  it("refuses files below either, and says what the rules ask for", () => {
    const result = preExportCheck(fixtureSubject({ print: { ...print, dpi: 96, bleedMm: 3 } }));
    expect(itemOf(result, "dpi")?.findings[0]?.message).toBe("Print files: 96 DPI is below the 150 DPI the rules ask for.");
    expect(itemOf(result, "bleed")?.findings[0]?.message).toBe("Print files: 3 mm bleed is below the 10 mm the rules ask for.");
  });
});

describe("moderation", () => {
  it("passes a cleared design", () => {
    expect(itemOf(preExportCheck(fixtureSubject()), "moderation")?.status).toBe("pass");
  });

  it("refuses a blocked, a flagged and an unfinished check, each in its own words", () => {
    for (const state of ["blocked", "flagged", "pending"] as const) {
      const found = itemOf(preExportCheck(fixtureSubject({ moderation: { state, productionClass: "A", humanAllowed: null } })), "moderation");
      expect(found?.status).toBe("fail");
      expect(found?.findings[0]?.code).toBe(`moderation_${state}`);
    }
  });

  it("notes a design that was never screened, rather than refusing it", () => {
    const found = itemOf(preExportCheck(fixtureSubject({ moderation: { state: "not_built", productionClass: "A", humanAllowed: null } })), "moderation");
    expect(found?.findings[0]?.severity).toBe("warning");
  });
});

describe("the Class B human review", () => {
  it("is not asked of any other class", () => {
    expect(requiresHumanReview("A")).toBe(false);
    expect(requiresHumanReview(null)).toBe(false);
    expect(requiresHumanReview("B")).toBe(true);
    expect(classBReviewFinding({ state: "clear", productionClass: "A", humanAllowed: null })).toBeNull();
  });

  it("refuses a Class B design nobody has been asked about", () => {
    const found = classBReviewFinding({ state: "clear", productionClass: "B", humanAllowed: null });
    expect(found).toMatchObject({ code: "class_b_human_review_required", severity: "blocker" });
    expect(found?.message).toContain("nobody has been asked yet");
  });

  it("refuses a Class B design waiting in the queue, and says where it is", () => {
    const found = classBReviewFinding({ state: "clear", productionClass: "B", humanAllowed: false });
    expect(found?.message).toContain("in the review queue");
  });

  it("lets a Class B design through once a person has allowed it", () => {
    expect(classBReviewFinding({ state: "clear", productionClass: "B", humanAllowed: true })).toBeNull();
    expect(preExportCheck(fixtureSubject({ moderation: { state: "clear", productionClass: "B", humanAllowed: true } })).clear).toBe(true);
  });

  it("never looks at a quantity: the 50 to 300 range is lib/make/run.ts's flag, not this gate", () => {
    const result = preExportCheck(fixtureSubject({ moderation: { state: "clear", productionClass: "B", humanAllowed: true } }));
    expect(result.blockers.map((found) => found.code)).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("piece");
  });
});
