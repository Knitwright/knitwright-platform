import { describe, expect, it } from "vitest";
import { askRulebook, gapCodeFor, type AskDeps } from "./ask";
import { NOT_COVERED, UNGROUNDED, gradeAnswer } from "./grader";
import { COVERED, DESIGN, QUESTIONS, UNCOVERED } from "./fixtures/questions";
import { DRAFT_RULES, REVIEWED_RULES } from "./fixtures/rules";
import { fixtureRetrieval } from "./fixtures/search";
import { stubModel } from "./fixtures/stub";
import type { AskResult, RetrievedRule } from "./types";

/**
 * The 50-question set the plan asks for, against a stubbed model and the real 45 rules of the JSY-SS-01
 * rulebook. Three things are shown, each for all 50 questions:
 *
 *  1. every answer cites only rules the search retrieved, and every sentence of it cites one;
 *  2. the five questions the rulebook does not answer come back "not covered", with a line in the gap list and
 *     no answer assembled out of a rule about something else;
 *  3. the same 50 answers with one invented sentence added are all turned down. A grader that only passed good
 *     answers would prove nothing; this is the half that matters.
 *
 * The spec's own acceptance test for F-S5 is "in a 50-question test set, 0 answers state a fact not in the
 * rulebook", so the fourth reading — every measurement in a sentence is one the cited rule states — is run over
 * all 50 as well.
 */

const gaps: { code: string; context: string }[] = [];

const deps = (model: AskDeps["model"], reader: AskDeps["reader"] = "member", rules = REVIEWED_RULES): AskDeps => ({
  retrieval: fixtureRetrieval(rules),
  logGap: async (gap) => {
    gaps.push(gap);
  },
  model,
  reader,
});

const ask = (question: string, model = stubModel({ rules: 2 }), reader: AskDeps["reader"] = "member") =>
  askRulebook(deps(model, reader), { question, scope: DESIGN });

const ids = (rules: readonly RetrievedRule[]): string[] => rules.map((rule) => rule.ruleId);

describe("the question set itself", () => {
  it("holds fifty questions: one for each of the forty-five rules, and five the rulebook does not answer", () => {
    expect(QUESTIONS).toHaveLength(50);
    expect(UNCOVERED).toHaveLength(5);
    expect(new Set(COVERED.map((item) => item.expect)).size).toBe(45);
    expect(new Set(QUESTIONS.map((item) => item.question)).size).toBe(50);
  });

  it("asks about every rule the rulebook holds", () => {
    const asked = new Set(COVERED.map((item) => item.expect));
    const seeded = new Set(REVIEWED_RULES.map((entry) => entry.ruleId));
    expect([...seeded].filter((ruleId) => !asked.has(ruleId))).toEqual([]);
  });
});

describe("retrieval over the 50 questions", () => {
  it("finds the rule each of the 45 answerable questions is about", async () => {
    const missed: string[] = [];
    for (const item of COVERED) {
      const result = await ask(item.question);
      const found = result.kind === "not_covered" ? [] : ids(result.rules);
      if (!found.includes(String(item.expect))) missed.push(`${item.expect}: ${item.question} found ${found.join(", ") || "nothing"}`);
    }
    expect(missed).toEqual([]);
  });

  it("finds nothing for the five questions the rulebook does not answer, and counts each one as a gap", async () => {
    gaps.length = 0;
    for (const item of UNCOVERED) {
      const result = await ask(item.question);
      expect(result.kind, item.question).toBe("not_covered");
      if (result.kind === "not_covered") expect(result.message).toBe(NOT_COVERED);
    }
    expect(gaps.map((gap) => gap.code)).toEqual(UNCOVERED.map((item) => gapCodeFor(item.question)));
    expect(gaps.every((gap) => gap.context.includes("JSY-SS-01 sublimation"))).toBe(true);
  });
});

describe("every answer to the 50 questions", () => {
  const answers: AskResult[] = [];

  it("is graded clean, and cites only rules the search retrieved", async () => {
    const wrong: string[] = [];
    for (const item of QUESTIONS) {
      const result = await ask(item.question);
      answers.push(result);
      if (item.expect === null) continue;
      if (result.kind !== "answer") {
        wrong.push(`${item.question}: ${result.kind}`);
        continue;
      }
      const retrieved = new Set(ids(result.rules));
      for (const id of result.grade.cited) if (!retrieved.has(id)) wrong.push(`${item.question} cites ${id}, which was not retrieved`);
      if (!result.grade.ok) wrong.push(`${item.question}: ${result.grade.defects.map((defect) => defect.detail).join("; ")}`);
    }
    expect(wrong).toEqual([]);
    expect(answers.filter((answer) => answer.kind === "answer")).toHaveLength(45);
  });

  it("has a citation on every single sentence", async () => {
    const uncited: string[] = [];
    for (const item of COVERED) {
      const result = await ask(item.question);
      if (result.kind !== "answer") continue;
      for (const sentence of result.sentences) {
        if (!/R-[A-Z]{2,8}-\d{3}/.test(sentence.text)) uncited.push(`${item.question}: ${sentence.text}`);
        if (sentence.ruleIds.length === 0) uncited.push(`${item.question}: no id recorded for "${sentence.text}"`);
      }
    }
    expect(uncited).toEqual([]);
  });

  it("states no measurement the rule it cites does not state", async () => {
    const invented: string[] = [];
    for (const item of COVERED) {
      const result = await ask(item.question);
      if (result.kind !== "answer") continue;
      const grade = gradeAnswer(result.sentences, result.rules);
      invented.push(...grade.defects.filter((defect) => defect.kind === "measurement_not_in_the_rule").map((defect) => defect.detail));
    }
    expect(invented).toEqual([]);
  });
});

describe("the grader over the same 50 questions, with the answer tampered with", () => {
  const flaws = ["uncited", "unretrieved_id", "invented_measurement", "mismatch"] as const;

  for (const flaw of flaws) {
    it(`turns down every one of the 50 answers when the model adds a sentence that is ${flaw}`, async () => {
      const passed: string[] = [];
      for (const item of COVERED) {
        const result = await ask(item.question, stubModel({ flaw }));
        if (result.kind === "answer") passed.push(item.question);
        if (result.kind === "ungrounded") expect(result.message).toBe(UNGROUNDED);
      }
      expect(passed).toEqual([]);
    });
  }

  it("names the reading that caught each tampered answer", async () => {
    const found = new Map<string, string>();
    for (const flaw of flaws) {
      const result = await ask(COVERED[28].question, stubModel({ flaw }));
      if (result.kind === "ungrounded") found.set(flaw, result.defects[0] ?? "none");
    }
    expect([...found.entries()]).toEqual([
      ["uncited", "uncited_sentence"],
      ["unretrieved_id", "id_not_retrieved"],
      ["invented_measurement", "measurement_not_in_the_rule"],
      ["mismatch", "citation_mismatch"],
    ]);
  });
});

describe("a member and the team, over the same 50 questions", () => {
  it("answers a member nothing at all while every rule is still a draft (owner decision 11)", async () => {
    for (const item of COVERED.slice(0, 10)) {
      const result = await askRulebook(deps(stubModel(), "member", DRAFT_RULES), { question: item.question, scope: DESIGN });
      expect(result.kind, item.question).toBe("not_covered");
    }
  });

  it("answers the Knitwright team out of those same drafts", async () => {
    for (const item of COVERED.slice(0, 10)) {
      const result = await askRulebook(deps(stubModel(), "ops", DRAFT_RULES), { question: item.question, scope: DESIGN });
      expect(result.kind, item.question).toBe("answer");
    }
  });
});
