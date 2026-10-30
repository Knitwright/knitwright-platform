import { describe, expect, it } from "vitest";
import { checklistSentence, findingsOf, itemOf, preExportCheck, ruleIdsOf, whyNotClear } from "./checklist";
import { fixtureLabelInput, fixtureSubject, SEEDED_CARE_SYMBOLS, SEEDED_LABEL_RULES_GB } from "./fixtures/rows";
import { destinationLabel } from "./labels";
import { CHECKLIST_ITEM_IDS, CHECKLIST_TITLES } from "./model";
import type { PreExportSubject } from "./subject";

const seededLabel = () => destinationLabel(fixtureLabelInput({ labelRules: SEEDED_LABEL_RULES_GB, careSymbols: SEEDED_CARE_SYMBOLS }));

describe("the one checklist", () => {
  it("runs every item of F-G2, in the spec's order, whatever the subject", () => {
    expect(preExportCheck(fixtureSubject()).items.map((item) => item.id)).toEqual([...CHECKLIST_ITEM_IDS]);
    expect(preExportCheck(fixtureSubject({ source: "order", print: null })).items.map((item) => item.id)).toEqual([...CHECKLIST_ITEM_IDS]);
  });

  it("gives every item its title, so a screen never has to name one itself", () => {
    for (const item of preExportCheck(fixtureSubject()).items) expect(item.title).toBe(CHECKLIST_TITLES[item.id]);
  });

  it("is clear for a subject with nothing against it", () => {
    const result = preExportCheck(fixtureSubject());
    expect(result.clear).toBe(true);
    expect(whyNotClear(result)).toBeNull();
    expect(result.blockers).toEqual([]);
  });

  it("is not clear while a label may not be used, and the refusal is the label's own words", () => {
    const result = preExportCheck(fixtureSubject({ labels: [seededLabel()] }));
    expect(result.clear).toBe(false);
    expect(whyNotClear(result)).toContain("No care symbols are chosen");
  });

  it("says which items it did not check here rather than calling them passed", () => {
    const result = preExportCheck(fixtureSubject());
    expect(itemOf(result, "dpi")).toMatchObject({ status: "skipped", skipped: "not_in_this_source" });
    expect(itemOf(result, "class_b_human_review")).toMatchObject({ status: "skipped", skipped: "nothing_to_check" });
    expect(itemOf(result, "poms")?.status).toBe("pass");
  });

  it("marks an item that found only notes as a warning, not a failure", () => {
    const result = preExportCheck(fixtureSubject({ moderation: { state: "not_built", productionClass: "A", humanAllowed: null } }));
    expect(itemOf(result, "moderation")?.status).toBe("warn");
    expect(result.clear).toBe(true);
    expect(result.warnings).toHaveLength(1);
  });

  it("answers nothing for an item id it does not have", () => {
    expect(itemOf(preExportCheck(fixtureSubject()), "needs_input")).not.toBeNull();
  });

  it("gives the same items, findings and order every time", () => {
    const subject: PreExportSubject = fixtureSubject({ labels: [seededLabel()], tbcPaths: ["cover.season"] });
    expect(preExportCheck(subject)).toEqual(preExportCheck(subject));
  });

  it("keeps the source it was given, so a caller knows which of the three it read", () => {
    expect(preExportCheck(fixtureSubject({ source: "package" })).source).toBe("package");
  });
});

describe("the sentence a person reads", () => {
  it("counts what is left to put right", () => {
    expect(checklistSentence(preExportCheck(fixtureSubject({ tbcPaths: ["cover.season"] })))).toBe("1 thing to put right before this can go to a factory.");
    expect(checklistSentence(preExportCheck(fixtureSubject({ tbcPaths: ["cover.season", "cover.brand"] })))).toContain("2 things");
  });

  it("never says ready on its own: it says which checks were not run here", () => {
    expect(checklistSentence(preExportCheck(fixtureSubject()))).toBe("Every check that applies passed; 3 were not checked here.");
  });

  it("counts the notes that go with a clear result", () => {
    const result = preExportCheck(fixtureSubject({ moderation: { state: "not_built", productionClass: "A", humanAllowed: null } }));
    expect(checklistSentence(result)).toContain("1 note goes with it.");
  });

  it("says every check passed when every one of them ran", () => {
    const result = preExportCheck(
      fixtureSubject({
        print: { dpi: 150, minDpi: 150, bleedMm: 10, minBleedMm: 10, ruleId: "R-SUB-002" },
        moderation: { state: "clear", productionClass: "B", humanAllowed: true },
      }),
    );
    expect(checklistSentence(result)).toBe("Every check passed.");
  });
});

describe("what a PR comment and a popover list", () => {
  it("names every rule id once, sorted", () => {
    const result = preExportCheck(fixtureSubject({ labels: [seededLabel()], tbcPaths: ["cover.season"] }));
    expect(ruleIdsOf(result)).toEqual(["R-GAP-000", "R-LAB-002"]);
  });

  it("lists the blockers before the notes", () => {
    const result = preExportCheck(
      fixtureSubject({ labels: [seededLabel()], moderation: { state: "not_built", productionClass: "A", humanAllowed: null } }),
    );
    const found = findingsOf(result);
    expect(found[found.length - 1]?.severity).toBe("warning");
    expect(found[0]?.severity).toBe("blocker");
  });
});
