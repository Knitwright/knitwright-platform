import { describe, expect, it } from "vitest";
import { exportGate } from "@/lib/techpack/exports/review-gate";
import { preExportCheck } from "./checklist";
import { reviewStateFrom } from "./export-gate";
import { fixtureLabelInput, fixtureSubject, SEEDED_CARE_SYMBOLS, SEEDED_LABEL_RULES_GB } from "./fixtures/rows";
import { destinationLabel } from "./labels";

/**
 * The one checklist against Y5's Export panel gate (decision 0078). The panel is shut for exactly the reasons
 * the Review tab lists, because they are one result read twice.
 */

const seededLabel = () => destinationLabel(fixtureLabelInput({ labelRules: SEEDED_LABEL_RULES_GB, careSymbols: SEEDED_CARE_SYMBOLS }));
const gateFor = (over = {}) => exportGate(reviewStateFrom(preExportCheck(fixtureSubject(over))));

describe("the Export panel over a clear checklist", () => {
  it("is open, with nothing to do and no caution", () => {
    expect(gateFor()).toEqual({ open: true, reason: null, items: [], caution: null });
  });

  it("stays open over a note, because a note does not shut a gate", () => {
    expect(gateFor({ moderation: { state: "not_built", productionClass: "A", humanAllowed: null } }).open).toBe(true);
  });

  it("never shows the not-reviewed-yet caution: a checklist result is the Review tab's own report", () => {
    expect(reviewStateFrom(preExportCheck(fixtureSubject())).reviewed).toBe(true);
    expect(gateFor({ labels: [seededLabel()] }).caution).toBeNull();
  });
});

describe("the Export panel over a checklist with something against it", () => {
  it("is shut by a field that still needs input, and says so in the Review tab's words", () => {
    const gate = gateFor({ needsInput: [{ path: "fields.season", label: "Season", ruleId: "R-SUB-001" }] });
    expect(gate.open).toBe(false);
    expect(gate.reason).toContain("The Review tab still asks for something");
    expect(gate.items[0]).toMatchObject({ label: "Season: needs your input.", tab: "review", ruleId: "R-SUB-001" });
  });

  it("is shut by a label a market will not allow, and names the tab the label is on", () => {
    const gate = gateFor({ labels: [seededLabel()] });
    expect(gate.open).toBe(false);
    expect(gate.items.map((item) => item.tab)).toEqual(["labelling", "labelling", "labelling"]);
    expect(gate.items.map((item) => item.ruleId)).toEqual(["R-LAB-002", "R-LAB-002", "R-GAP-000"]);
  });

  it("is shut by a Class B design nobody has reviewed, with no tab to send the person to", () => {
    const gate = gateFor({ moderation: { state: "clear", productionClass: "B", humanAllowed: null } });
    expect(gate.open).toBe(false);
    expect(gate.items[0]).toMatchObject({ tab: null });
    expect(gate.items[0]?.label).toContain("look at this design first");
  });

  it("sends a measurement, a material and a colour to their own tabs", () => {
    const gate = gateFor({
      poms: [{ letter: "A", description: "Chest width", missingSizes: ["M"], hasTolerance: false, needsInput: false, ruleId: "R-FIT-001" }],
      bom: [{ item: "Main fabric", kind: "fabric", gaps: ["no quantity"], ruleId: "R-SUB-001" }],
      colour: { fabric: "F-POLY-INT", roles: [{ role: "primary", hex: null, pantoneTcx: null, swatchId: null }], toleranceMax: 1.5, ruleId: "R-SUB-005" },
    });
    expect([...new Set(gate.items.map((item) => item.tab))]).toEqual(["measurements", "components", "colourways"]);
  });

  it("lists each finding once, however many items name it", () => {
    const gate = gateFor({ tbcPaths: ["bom[0].spec"], needsInput: [{ path: "fields.season", label: "Season", ruleId: "R-GAP-000" }] });
    expect(new Set(gate.items.map((item) => item.key)).size).toBe(gate.items.length);
    expect(gate.items).toHaveLength(2);
  });

  it("gives every item a key of its own, so the list does not jump about", () => {
    const state = reviewStateFrom(preExportCheck(fixtureSubject({ labels: [seededLabel()] })));
    expect(new Set(state.blockers.map((item) => item.key)).size).toBe(state.blockers.length);
    expect(state.blockers[0]?.key).toBe("labels:labels.gb.care");
  });
});
