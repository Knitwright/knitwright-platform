import { describe, expect, it } from "vitest";
import { GAP_RULE_ID, type RulebookEntry } from "./constants";
import { RULEBOOK_MD } from "./fixtures/files";
import { parseRulebookMarkdown } from "./markdown";
import { CHOICE, choiceOf, parseChoice, signOffDone, signOffLabel, signOffLead, signOffPlan, waitsFor } from "./sign-off";

/**
 * The sign-off's two piles, read off the rulebook itself rather than a list typed here: the Source column says
 * which rules rest on Knitwright's own words or a published standard and which still defer to somebody who has
 * not spoken. If an edit to the rulebook changes which of those a rule is, this test moves with it.
 */

const seeded = (): RulebookEntry[] =>
  parseRulebookMarkdown(RULEBOOK_MD, "JSY-SS-01").map((rule, index) => ({
    id: `row-${index}`,
    ruleId: rule.ruleId,
    version: 1,
    topic: rule.topic,
    articleCodes: rule.articleCodes,
    methods: [],
    scopeNote: "",
    title: rule.title,
    rule: rule.rule,
    body: rule.body,
    bestPractice: rule.bestPractice,
    source: rule.source,
    sourceNote: rule.sourceNote,
    status: "draft",
    confirmedAt: null,
    confirmedBy: null,
    confirmedName: null,
    confirmedRole: null,
    createdAt: "2026-10-25T00:00:00.000Z",
  }));

describe("who a source note is waiting for", () => {
  it("names the party a deferring note defers to", () => {
    expect(waitsFor("Factory to confirm their RIP settings")).toBe("a factory");
    expect(waitsFor("Knitwright draft; replace with factory block values")).toBe("a factory");
    expect(waitsFor("Regulation trend; supplier declaration")).toBe("a supplier");
    expect(waitsFor("Supplier price lists, May 2026; replace with partner quote")).toBe("a supplier");
    expect(waitsFor("UK Textile Products regulations; Australian care labelling standard. Confirm with legal consult")).toBe("a lawyer");
    expect(waitsFor("Knitwright draft; range approved only after a sample at each end")).toBe("a sample");
  });

  it("is nobody for a note that rests on a standard, a settled practice or Knitwright's own choice", () => {
    for (const note of ["Industry standard", "Sublimation practice", "Grading practice", "Process physics", "AQL standard (ISO 2859-1)", "Knitwright draft", "Common competition practice; check league rules"]) {
      expect([note, waitsFor(note)]).toEqual([note, null]);
    }
  });
});

describe("the sign-off plan over the seeded rulebook", () => {
  const plan = signOffPlan(seeded());

  it("holds all 45 rules, 29 of them Knitwright's own or a standard", () => {
    expect(plan.owned.length + plan.waiting.length).toBe(45);
    expect(plan.owned.length).toBe(29);
  });

  it("holds back exactly the sixteen whose own Source column defers, and says who each waits for", () => {
    expect(plan.waiting.map((rule) => rule.ruleId)).toEqual([
      "R-CON-004", "R-CON-005", "R-CON-006", "R-CON-008",
      "R-COST-002", "R-COST-003",
      "R-FIT-001",
      "R-LAB-002", "R-LAB-003",
      "R-PAT-001", "R-PAT-003", "R-PAT-008",
      "R-SUB-003", "R-SUB-005", "R-SUB-006", "R-SUB-008",
    ]);
    expect(plan.waiting.every((rule) => rule.waitsFor !== null && rule.sourceNote !== "")).toBe(true);
    expect(plan.owned.every((rule) => rule.waitsFor === null)).toBe(true);
  });

  it("leaves out R-GAP-000, which stands in for a check with no rule and so cannot be reviewed", () => {
    const gap = { ...seeded()[0]!, ruleId: GAP_RULE_ID, sourceNote: "Plan v5, workstream X2" };
    const withGap = signOffPlan([...seeded(), gap]);
    expect([...withGap.owned, ...withGap.waiting].map((rule) => rule.ruleId)).not.toContain(GAP_RULE_ID);
  });

  it("leaves out a rule already confirmed, and offers only the newest version of the rest", () => {
    const of = (ruleId: string) => seeded().find((row) => row.ruleId === ruleId)!;
    const rows = seeded().map((row) => (row.ruleId === "R-PAT-004" ? { ...row, status: "confirmed" as const } : row));
    const plan = signOffPlan([...rows, { ...of("R-PAT-002"), id: "next", version: 4 }]);

    expect(plan.owned.map((rule) => rule.ruleId)).not.toContain("R-PAT-004");
    expect(plan.owned.find((rule) => rule.ruleId === "R-PAT-002")?.version).toBe(4);
    expect(plan.owned.length).toBe(28);
  });
});

describe("what a rule looks like in the form", () => {
  it("carries the rule and the version it was offered at, and reads back to the same pair", () => {
    expect(choiceOf({ ruleId: "R-SUB-004", version: 2 })).toBe("R-SUB-004@2");
    expect(CHOICE.test("R-SUB-004@2")).toBe(true);
    expect(parseChoice(" R-SUB-004@2 ")).toEqual({ ruleId: "R-SUB-004", version: 2 });
  });

  it("reads nothing back out of anything that is not a rule of the rulebook", () => {
    for (const raw of ["", "R-SUB-004", "R-SUB-004@", "@1", "R-sub-004@1", "R-SUB-004@0.5", "R-SUB-004@1; drop table", "R-TOOLONGFAMILY-004@1"]) {
      expect([raw, parseChoice(raw)]).toEqual([raw, null]);
    }
  });
});

describe("what the form says", () => {
  const plan = signOffPlan(seeded());

  it("counts in plain words, and says why the button is off before anything is ticked", () => {
    expect(signOffLabel(0)).toBe("Tick a rule to confirm");
    expect(signOffLabel(1)).toBe("Confirm 1 rule");
    expect(signOffLabel(29)).toBe("Confirm 29 rules");
    expect(signOffDone(29)).toBe("29 rules confirmed. Those are the words members see from now on.");
  });

  it("says what is ticked, what is not, and who the rest wait for", () => {
    expect(signOffLead(plan)).toBe(
      "29 drafts rest on Knitwright's own words or a published standard, and are ticked. 16 others wait for a factory, a supplier, a lawyer, a sample, and are not.",
    );
  });

  it("says it plainly when there is nothing held back, and when everything is", () => {
    expect(signOffLead({ owned: plan.owned, waiting: [] })).toBe("29 drafts to sign off. Every one of them is Knitwright's own words or a published standard.");
    expect(signOffLead({ owned: [], waiting: plan.waiting })).toContain("waiting for a factory or a supplier or a lawyer or a sample");
  });
});
