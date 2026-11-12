import { describe, expect, it } from "vitest";
import { preExportCheck } from "@/lib/compliance/checklist";
import { fixtureLabelInput, fixtureSubject } from "@/lib/compliance/fixtures/rows";
import { destinationLabel } from "@/lib/compliance/labels";
import { fullDesign, packFor } from "@/lib/techpack/fixtures/designs";
import { CHECKLIST_REFUSES_ORDER, checklistAtOrder, checklistForOrder, MOST_CARRIED, type OrderChecklistFacts } from "./order-checks";

/** Plan v6 D1 (decision 0132): the F-G2 checklist runs at every order through `subjectForOrder`. */

const facts = (over: Partial<OrderChecklistFacts> = {}): OrderChecklistFacts => ({
  labels: [destinationLabel(fixtureLabelInput())],
  productionClass: "A",
  humanAllowed: null,
  moderation: "clear",
  colourToleranceMax: 1.5,
  ...over,
});

describe("the checklist at an order", () => {
  it("is the order's reading of the version's own tech pack", () => {
    const result = checklistForOrder(packFor(fullDesign("team-jersey")), facts());
    expect(result.source).toBe("order");
    expect(result.items.map((item) => item.id)).toContain("labels");
  });

  it("reads the markets and the screen the order brings, not the document's", () => {
    const pack = packFor(fullDesign("team-jersey"));
    const none = checklistForOrder(pack, facts({ labels: [] }));
    expect(none.blockers.map((found) => found.code)).toContain("labels_none");
    const flagged = checklistForOrder(pack, facts({ moderation: "flagged" }));
    expect(flagged.blockers.map((found) => found.code)).toContain("moderation_flagged");
  });

  it("asks for a person's review of a Class B run, and is satisfied once one has allowed it", () => {
    const pack = packFor(fullDesign("team-jersey"));
    const codes = (over: Partial<OrderChecklistFacts>) => checklistForOrder(pack, facts(over)).blockers.map((found) => found.code);
    expect(codes({ productionClass: "B" })).toContain("class_b_human_review_required");
    expect(codes({ productionClass: "B", humanAllowed: true })).not.toContain("class_b_human_review_required");
  });
});

describe("what an order does with the checklist", () => {
  const failing = () => preExportCheck(fixtureSubject({ source: "order", tbcPaths: ["bom[0].spec"], needsInput: [{ path: "cover.style", label: "Style number", ruleId: "R-GAP-000" }] }));

  it("carries it to ops while the owner has not said it refuses (decision 0132, owner question D1-2)", () => {
    expect(CHECKLIST_REFUSES_ORDER).toBe(false);
    const verdict = checklistAtOrder(failing());
    expect(verdict.status).toBe("go");
    if (verdict.status !== "go") return;
    expect(verdict.flags[0]).toMatchObject({ code: "pre_export_check", text: expect.stringContaining("2 things to put right") });
    expect(verdict.flags.map((flag) => flag.code)).toEqual(["pre_export_check", "pre_export_needs_input", "pre_export_tbc"]);
    expect(verdict.flags[1]?.text).toMatch(/^Open: /);
  });

  it("refuses with the checklist's own words once the setting is turned", () => {
    expect(checklistAtOrder(failing(), true)).toEqual({ status: "refused", message: expect.stringContaining("Style number: needs your input.") });
  });

  it("goes through a clear checklist either way, saying so in one flag", () => {
    const clear = preExportCheck(fixtureSubject({ source: "order" }));
    expect(checklistAtOrder(clear, true)).toMatchObject({ status: "go", flags: [{ code: "pre_export_check" }] });
  });

  it("names at most a handful of findings, so the flags an order stores stay small", () => {
    const many = preExportCheck(fixtureSubject({ source: "order", tbcPaths: Array.from({ length: 20 }, (_, n) => `notes[${n}]`) }));
    const verdict = checklistAtOrder(many);
    expect(verdict.status === "go" ? verdict.flags.length : 0).toBe(MOST_CARRIED + 1);
    expect(JSON.stringify(verdict).length).toBeLessThan(8192);
  });
});
