import type { ModelReply, ModelRequest, TextModelProvider } from "@/lib/providers/text-model";
import { NOT_COVERED } from "../grader";
import { sentencesOf } from "../sentences";

/**
 * The deterministic stub behind every test of the Ask box. It never reaches the network and no test, and no run
 * of the repository's own tooling, ever makes a paid call.
 *
 * `groundedStub` is what a model that followed its instructions would send: it reads the rules out of the
 * request itself and restates the best one in the rule's own words, one sentence at a time, each ending with
 * that rule's id. Every other stub here breaks exactly one of the grader's four readings, so each reading can be
 * shown to bite.
 */

/** The rules in a request, in the order the prompt put them: their ids and their `rule:` lines. */
export function rulesInRequest(request: ModelRequest): { ruleId: string; rule: string }[] {
  return request.user
    .split("\n\n")
    .flatMap((block) => {
      const ruleId = /^id: (R-[A-Z]{2,8}-\d{3})$/m.exec(block)?.[1];
      const rule = /^rule: (.+)$/m.exec(block)?.[1];
      return ruleId && rule ? [{ ruleId, rule }] : [];
    });
}

const cite = (sentence: string, ruleId: string): string => `${sentence.replace(/[.!?]+$/, "")} (${ruleId}).`;

/** The rule restated sentence by sentence, each sentence citing it. What a well-behaved reply looks like. */
export const groundedSentences = (ruleId: string, rule: string): { text: string; ruleIds: string[] }[] =>
  sentencesOf(rule).map((sentence) => ({ text: cite(sentence, ruleId), ruleIds: [ruleId] }));

const json = (value: unknown): string => JSON.stringify(value);

/** How many of the retrieved rules a stub answers from. One is the usual case; two covers a two-sided question. */
export type StubShape = Readonly<{
  /** Breaks one of the grader's readings, so the test can show which one catches it. */
  flaw?: "uncited" | "unretrieved_id" | "invented_measurement" | "mismatch" | "empty";
  rules?: number;
}>;

const flawed = (flaw: StubShape["flaw"], ruleId: string): { text: string; ruleIds: string[] }[] => {
  switch (flaw) {
    case "uncited":
      return [{ text: "Flatlock seams are always softer against the skin than an overlock.", ruleIds: [] }];
    case "unretrieved_id":
      return [{ text: "The factory holds that tolerance (R-ZZZ-999).", ruleIds: ["R-ZZZ-999"] }];
    case "invented_measurement":
      return [{ text: `Keep artwork 42 mm away from every seam (${ruleId}).`, ruleIds: [ruleId] }];
    case "mismatch":
      return [{ text: `Panels shift slightly when they are sewn (${ruleId}).`, ruleIds: [] }];
    default:
      return [];
  }
};

/**
 * A model that answers out of the rules it was given. With a `flaw`, one more sentence is added that breaks that
 * one reading, so a grounded answer and a broken one differ by exactly the thing being tested.
 */
export function stubModel(shape: StubShape = {}): TextModelProvider & { readonly requests: readonly ModelRequest[] } {
  const requests: ModelRequest[] = [];
  return {
    provider: "stub",
    model: "stub-ask",
    requests,
    async complete(request: ModelRequest): Promise<ModelReply> {
      requests.push(request);
      const rules = rulesInRequest(request);
      const answered = rules.slice(0, Math.max(1, shape.rules ?? 1));
      const sentences = [
        ...answered.flatMap((rule) => groundedSentences(rule.ruleId, rule.rule)),
        ...(shape.flaw ? flawed(shape.flaw, rules[0]?.ruleId ?? "R-GAP-000") : []),
      ];
      const text =
        shape.flaw === "empty" || rules.length === 0
          ? json({ covered: false, sentences: [] })
          : json({ covered: true, sentences });
      return { text, model: "stub-ask", usage: { inputTokens: 100, outputTokens: 100 } };
    },
  };
}

/** A model that says the rulebook does not cover the question, in the words the instructions ask for. */
export const notCoveredStub = (): TextModelProvider =>
  stubModelAnswering(json({ covered: false, sentences: [{ text: NOT_COVERED, ruleIds: [] }] }));

/** A model that always sends the same text, whatever it is asked. For replies that cannot be read at all. */
export function stubModelAnswering(text: string | Error): TextModelProvider {
  return {
    provider: "stub",
    model: "stub-ask",
    async complete(): Promise<ModelReply> {
      if (text instanceof Error) throw text;
      return { text, model: "stub-ask", usage: { inputTokens: 1, outputTokens: 1 } };
    },
  };
}
