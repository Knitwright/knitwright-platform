import { describe, expect, it } from "vitest";
import { SUBLIMATION } from "../scope";
import { entry } from "../fixtures/entries";
import { NEWER_DRAFT_LINE } from "../view";
import { DRAFT_RULES, REVIEWED_RULES } from "./fixtures/rules";
import { fixtureRetrieval, searchFixtureRules, stem, wordsOf } from "./fixtures/search";
import { byRule, MIN_MATCHED, namedRuleIds, retrieveRules, shortlist, shownRule } from "./retrieve";
import type { SearchHit } from "./types";

/**
 * Retrieval (decision 0083): which rules a question reaches, and which version of each the person asking may be
 * shown. Owner decisions 11 and 12 are both applied here, so both are tested here: a member is never shown a
 * draft's words, and a rule scoped to the sublimation method is not handed to a question about another article.
 */

const hit = (ruleId: string, rank: number, matched: number, asked = 4): SearchHit => ({ ruleId, rank, matched, asked });

describe("the shortlist", () => {
  it("keeps the best first and drops a rule that holds too few of the question's words", () => {
    const hits = [hit("R-A-001", 0.4, 1), hit("R-B-002", 0.9, 3), hit("R-C-003", 0.6, 2)];
    expect(shortlist(hits).map((found) => found.ruleId)).toEqual(["R-B-002", "R-C-003"]);
  });

  it("matches a one-word question on its one word", () => {
    expect(shortlist([hit("R-A-001", 0.4, 1, 1)])).toHaveLength(1);
    expect(MIN_MATCHED).toBe(2);
  });

  it("holds the answer to no more rules than it was asked for", () => {
    const hits = Array.from({ length: 20 }, (_, index) => hit(`R-A-${String(index).padStart(3, "0")}`, index, 3));
    expect(shortlist(hits, 4)).toHaveLength(4);
  });
});

describe("a rule the question names by id", () => {
  it("reads it out of the question, however the question is written", () => {
    expect(namedRuleIds("what does r-sub-004 actually say?")).toEqual(["R-SUB-004"]);
    expect(namedRuleIds("R-SUB-004 and R-SUB-004 again, plus R-CON-001")).toEqual(["R-SUB-004", "R-CON-001"]);
    expect(namedRuleIds("rule 4 of the sublimation section")).toEqual([]);
  });

  it("retrieves it even when its words share nothing with the question", async () => {
    const rules = await retrieveRules(fixtureRetrieval(REVIEWED_RULES), "tell me about R-LAB-003", { method: SUBLIMATION }, "member");
    expect(rules.map((rule) => rule.ruleId)).toContain("R-LAB-003");
  });
});

describe("which version the person asking is shown (owner decision 11)", () => {
  const reviewed = { status: "confirmed" as const, confirmedAt: "2026-11-03T09:30:00Z", confirmedName: "Ana Lima", confirmedRole: "pattern master" };
  const found = hit("R-SUB-004", 1, 3);

  it("shows a member the newest version the factory has signed off", () => {
    const versions = [entry({ version: 1, rule: "First words", ...reviewed }), entry({ version: 2, rule: "Second words", ...reviewed })];
    expect(shownRule(versions, found, "member")?.rule).toBe("Second words");
  });

  it("shows a member the signed-off words and says a newer draft is waiting, never the draft's words", () => {
    const versions = [entry({ version: 1, rule: "Signed words", ...reviewed }), entry({ version: 2, rule: "Draft words" })];
    const rule = shownRule(versions, found, "member");
    expect(rule?.rule).toBe("Signed words");
    expect(rule?.newerDraft).toBe(NEWER_DRAFT_LINE);
  });

  it("shows a member nothing at all when no version has been signed off", () => {
    expect(shownRule([entry({ version: 1 })], found, "member")).toBeNull();
  });

  it("shows the Knitwright team the newest version whatever its status", () => {
    expect(shownRule([entry({ version: 1, ...reviewed }), entry({ version: 2, rule: "Draft words" })], found, "ops")?.rule).toBe("Draft words");
  });

  it("answers a member nothing while the whole rulebook is still drafts", async () => {
    const rules = await retrieveRules(fixtureRetrieval(DRAFT_RULES), "How much bleed do print files need?", {}, "member");
    expect(rules).toEqual([]);
  });
});

describe("how far a rule reaches (owner decision 12)", () => {
  it("does not hand a rule scoped to the sublimation method to a question about another article", () => {
    const shared = REVIEWED_RULES.filter((rule) => rule.ruleId.startsWith("R-LAB"));
    expect(searchFixtureRules(shared, "what goes on the care label?", { articleCode: "KNI-LS-02" }, 6)).toEqual([]);
    expect(searchFixtureRules(shared, "what goes on the care label?", { method: SUBLIMATION }, 6).length).toBeGreaterThan(0);
  });

  it("does not hand a rule about another article to a question about this one", () => {
    const pattern = REVIEWED_RULES.filter((rule) => rule.ruleId.startsWith("R-PAT"));
    expect(searchFixtureRules(pattern, "how many notches on the armhole?", { articleCode: "KNI-LS-02" }, 6)).toEqual([]);
  });

  it("leaves a rule out even when the question names it by id, if it does not cover what was asked about", () => {
    const rule = REVIEWED_RULES.find((found) => found.ruleId === "R-LAB-002");
    expect(shownRule(rule ? [rule] : [], hit("R-LAB-002", 0, 0, 0), "member", { articleCode: "KNI-LS-02" })).toBeNull();
    expect(shownRule(rule ? [rule] : [], hit("R-LAB-002", 0, 0, 0), "member", { method: SUBLIMATION })).not.toBeNull();
  });
});

describe("the fixture search, which stands in for the database's own", () => {
  it("cuts a word down the same way on both sides, so a match means the same thing", () => {
    expect(stem("seams")).toBe(stem("seam"));
    expect(stem("sublimation")).toBe("sublim");
    expect(wordsOf("Are the SEAMS sewn flat?")).toEqual(["seam", "sewn", "flat"]);
  });

  it("throws away the words the database throws away, so they can never count as a match", () => {
    expect(wordsOf("what is the and of it")).toEqual([]);
  });

  it("groups every version of one rule under its id", () => {
    expect([...byRule([entry({ version: 1 }), entry({ version: 2 })]).keys()]).toEqual(["R-SUB-004"]);
  });
});
