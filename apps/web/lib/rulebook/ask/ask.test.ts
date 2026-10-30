import { describe, expect, it, vi } from "vitest";
import { DEFAULT_MODEL, MAX_OUTPUT_TOKENS, modelEntry } from "@/lib/providers/catalog";
import { ModelCallError } from "@/lib/providers/text-model";
import { GAP_RULE_ID } from "../constants";
import { askRulebook, gapCodeFor, type AskDeps } from "./ask";
import { askCost } from "./cost";
import { NO_MODEL, NOT_COVERED, OVER_ALLOWANCE, UNGROUNDED } from "./grader";
import { MAX_QUESTION_LENGTH, SYSTEM, userInput } from "./prompt";
import { readReply } from "./reply";
import { DESIGN } from "./fixtures/questions";
import { REVIEWED_RULES } from "./fixtures/rules";
import { fixtureRetrieval } from "./fixtures/search";
import { notCoveredStub, stubModel, stubModelAnswering } from "./fixtures/stub";

/**
 * The Ask box from question to answer (decision 0083): the four endings, what the model is sent, and what is
 * charged for. No test here reaches a model or a database: the model is the deterministic stub and retrieval is
 * over the real 45 rules held in memory.
 */

const SEAM = "How far from a seam should a crest sit?";

const parts = (overrides: Partial<AskDeps> = {}) => {
  const gaps: { code: string; context: string }[] = [];
  const deps: AskDeps = {
    retrieval: fixtureRetrieval(REVIEWED_RULES),
    logGap: async (gap) => {
      gaps.push(gap);
    },
    model: stubModel(),
    reader: "member",
    ...overrides,
  };
  return { deps, gaps };
};

const ask = (question: string, overrides: Partial<AskDeps> = {}) => {
  const { deps, gaps } = parts(overrides);
  return askRulebook(deps, { question, scope: DESIGN }).then((result) => ({ result, gaps }));
};

describe("a question the rulebook answers", () => {
  it("answers out of the rules the search found, with the rules beside the answer", async () => {
    const { result } = await ask(SEAM);
    expect(result.kind).toBe("answer");
    if (result.kind !== "answer") return;
    expect(result.rules.map((rule) => rule.ruleId)).toContain("R-SUB-004");
    expect(result.sentences.every((sentence) => sentence.ruleIds.length > 0)).toBe(true);
    expect(result.grade.ok).toBe(true);
  });

  it("sends the model the fixed instructions and the retrieved rules, and the question only inside its fence", async () => {
    const model = stubModel();
    await ask(SEAM, { model });
    const request = model.requests[0];
    expect(request.system).toBe(SYSTEM);
    expect(request.maxOutputTokens).toBe(MAX_OUTPUT_TOKENS);
    expect(request.user).toContain("base article: JSY-SS-01");
    expect(request.user).toContain("made by: sublimation");
    expect(request.user).toContain(`<<<question>>>\n${SEAM}\n<<<question>>>`);
    expect(request.user).toContain("id: R-SUB-004");
  });

  it("does not reach a model at all when nothing was retrieved", async () => {
    const model = stubModel();
    await ask("Do you ship to Canada?", { model });
    expect(model.requests).toEqual([]);
  });
});

describe("a question nothing covers", () => {
  it("says so in the fixed words, carries R-GAP-000 and counts the question for the team", async () => {
    const { result, gaps } = await ask("How do I register a trademark for my brand?");
    expect(result).toEqual({
      kind: "not_covered",
      question: "How do I register a trademark for my brand?",
      ruleId: GAP_RULE_ID,
      message: NOT_COVERED,
    });
    expect(gaps).toEqual([
      {
        code: gapCodeFor("How do I register a trademark for my brand?"),
        context: "How do I register a trademark for my brand? (JSY-SS-01 sublimation)",
      },
    ]);
  });

  it("counts two askings of the same question under one code, whatever the punctuation", () => {
    expect(gapCodeFor("Do you ship to Canada?")).toBe(gapCodeFor("do you ship to canada"));
    expect(gapCodeFor("x".repeat(400)).length).toBeLessThanOrEqual(184);
  });

  it("says so when the model itself answers that the rules do not cover the question", async () => {
    const { result, gaps } = await ask(SEAM, { model: notCoveredStub() });
    expect(result.kind).toBe("not_covered");
    expect(gaps).toHaveLength(1);
  });

  it("records the scope as no article in particular when the question is not about a design", async () => {
    const { deps, gaps } = parts();
    await askRulebook(deps, { question: "Do you ship to Canada?" });
    expect(gaps[0].context).toContain("(no article in particular)");
  });
});

describe("an answer the grader turns down", () => {
  it("drops the model's words and offers the rules in the rulebook's own words", async () => {
    const { result } = await ask(SEAM, { model: stubModel({ flaw: "uncited" }) });
    expect(result.kind).toBe("ungrounded");
    if (result.kind !== "ungrounded") return;
    expect(result.message).toBe(UNGROUNDED);
    expect(result.rules.length).toBeGreaterThan(0);
    expect(JSON.stringify(result)).not.toContain("Flatlock seams are always softer");
    expect(result.defects).toEqual(["uncited_sentence"]);
  });

  it("does the same with a reply that cannot be read at all", async () => {
    for (const text of ["not json", '{"covered": "yes"}', '{"sentences": [{"text": ""}]}', ""]) {
      const { result } = await ask(SEAM, { model: stubModelAnswering(text) });
      expect(result.kind, text).toBe("ungrounded");
    }
  });

  it("does the same when the call itself fails, and gives the reservation back", async () => {
    const refund = vi.fn(async () => undefined);
    const { result } = await ask(SEAM, {
      model: stubModelAnswering(new ModelCallError("the vendor refused")),
      reserve: async () => ({ refund }),
    });
    expect(result.kind).toBe("ungrounded");
    expect(refund).toHaveBeenCalledOnce();
  });
});

describe("when the feature cannot run", () => {
  it("says plainly that asking is not switched on, and still shows the rules the search found", async () => {
    const { result } = await ask(SEAM, { model: null });
    expect(result.kind).toBe("unavailable");
    if (result.kind !== "unavailable") return;
    expect(result.message).toBe(NO_MODEL);
    expect(result.rules.map((rule) => rule.ruleId)).toContain("R-SUB-004");
  });

  it("says plainly when the allowance for asking is used up, and makes no call", async () => {
    const model = stubModel();
    const { result } = await ask(SEAM, { model, reserve: async () => null });
    expect(result.kind).toBe("unavailable");
    if (result.kind === "unavailable") expect(result.message).toBe(OVER_ALLOWANCE);
    expect(model.requests).toEqual([]);
  });

  it("reserves the one call before making it, out of the rules it is about to send", async () => {
    const reserve = vi.fn(async () => ({ refund: async () => undefined }));
    await ask(SEAM, { reserve });
    expect(reserve).toHaveBeenCalledOnce();
    const [rules, question] = reserve.mock.calls[0] as unknown as [{ ruleId: string }[], string];
    expect(rules.map((rule) => rule.ruleId)).toContain("R-SUB-004");
    expect(question).toBe(SEAM);
  });
});

describe("what one question costs", () => {
  const entry = modelEntry(DEFAULT_MODEL);

  it("is worked out from the catalogue's prices, the rules sent and the output limit", async () => {
    const rules = await fixtureRetrieval(REVIEWED_RULES).search(SEAM, DESIGN, 6);
    expect(rules.length).toBeGreaterThan(0);
    const cost = askCost(entry, [], SEAM);
    expect(cost.feature).toBe("ai");
    expect(cost.microdollars).toBeGreaterThan(0);
  });

  it("costs more when more rules are sent", async () => {
    const one = await fixtureRetrieval(REVIEWED_RULES).versions(["R-SUB-004"]);
    const rule = {
      ruleId: one[0].ruleId,
      version: 1,
      title: one[0].title,
      rule: one[0].rule,
      body: one[0].body,
      bestPractice: one[0].bestPractice,
      scope: "x",
      newerDraft: null,
      hit: { ruleId: one[0].ruleId, rank: 1, matched: 2, asked: 3 },
    };
    expect(askCost(entry, [rule, rule], SEAM).microdollars).toBeGreaterThan(askCost(entry, [rule], SEAM).microdollars);
  });
});

describe("what the model is given and what comes back", () => {
  it("cuts a question that is too long rather than sending all of it", () => {
    expect(userInput("x".repeat(500), [])).toContain("x".repeat(MAX_QUESTION_LENGTH));
    expect(userInput("x".repeat(500), [])).not.toContain("x".repeat(MAX_QUESTION_LENGTH + 1));
  });

  it("reads a reply that says the rulebook covers the question but holds no sentence as not covered", () => {
    expect(readReply('{"covered": true, "sentences": []}')).toEqual({ covered: false, sentences: [] });
  });

  it("reads a reply out of a code fence, and upper-cases the ids it records", () => {
    const reply = readReply('```json\n{"covered": true, "sentences": [{"text": "A (r-sub-004).", "ruleIds": ["r-sub-004"]}]}\n```');
    expect(reply?.sentences[0].ruleIds).toEqual(["R-SUB-004"]);
  });

  it("refuses a reply with an id of the wrong shape, rather than guessing what was meant", () => {
    expect(readReply('{"covered": true, "sentences": [{"text": "A (RSUB4).", "ruleIds": ["RSUB4"]}]}')).toBeNull();
  });
});
