import { MAX_OUTPUT_TOKENS } from "@/lib/providers/catalog";
import type { TextModelProvider } from "@/lib/providers/text-model";
import { GAP_RULE_ID } from "../constants";
import type { RuleReader } from "../select";
import type { GapNote } from "../store";
import { gradeAnswer, NO_MODEL, NOT_COVERED, OVER_ALLOWANCE, UNGROUNDED } from "./grader";
import { SYSTEM, userInput } from "./prompt";
import { readReply } from "./reply";
import { retrieveRules, type Retrieval } from "./retrieve";
import type { AskGrade, AskResult, AskScope, RetrievedRule } from "./types";

/**
 * The Ask box, from question to answer (spec F-S5 v2, decision 0083): retrieve the rules that cover the
 * question, have the model phrase an answer out of those rules alone, and show it only if the grader finds
 * nothing wrong with it.
 *
 * Four endings, and three of them show the rulebook's own words rather than anything a model wrote:
 *
 *  * nothing retrieved: "not covered", carrying R-GAP-000, and the question is written to the gap list so the
 *    team can write the rule with the factory;
 *  * no model switched on: a plain line saying so, with the rules the search found;
 *  * an answer the grader turned down: the rules the search found, and the answer dropped;
 *  * an answer the grader passed: the model's sentences, each citing a rule that was retrieved.
 *
 * Nothing here reads a rule in the browser: the versions are read with the server's key and owner decision 11
 * chooses between them, so a draft's words never reach a member.
 */

export type AskDeps = Readonly<{
  /** The two reads retrieval needs: the ranked search and the versions of the rules it found. */
  retrieval: Retrieval;
  /** Counts one more question nothing covers, for the team's gap list. */
  logGap: (gap: GapNote) => Promise<void>;
  /** The configured model, or null when no key is set and the feature degrades to the rules themselves. */
  model: TextModelProvider | null;
  /** Owner decision 11: "ops" is the Knitwright team, "member" is everybody else. */
  reader: RuleReader;
  /**
   * Reserves the cost of the one paid call against the person's allowance, and gives it back when the call
   * fails. Null means an allowance refused it. Left out, the call is free (tests, and the team's own pages).
   */
  reserve?: (rules: readonly RetrievedRule[], question: string) => Promise<{ refund: () => Promise<void> } | null>;
  signal?: () => AbortSignal | undefined;
}>;

export type AskInput = Readonly<{ question: string; scope?: AskScope }>;

/** The gap code one unanswered question is counted under. Repeats of the same question count together. */
export const gapCodeFor = (question: string): string =>
  `ask:${question.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 180)}`;

const scopeNote = (scope: AskScope): string =>
  [scope.articleCode, scope.method].filter((part) => part !== undefined).join(" ") || "no article in particular";

/** A question nothing covers: the fixed words, R-GAP-000, and a line in the gap list for the team. */
async function notCovered(deps: AskDeps, input: AskInput, scope: AskScope): Promise<AskResult> {
  await deps.logGap({ code: gapCodeFor(input.question), context: `${input.question} (${scopeNote(scope)})` });
  return { kind: "not_covered", question: input.question, ruleId: GAP_RULE_ID, message: NOT_COVERED };
}

type Hold = Readonly<{ refund: () => Promise<void> }>;

/** The model's reply, or null when the call failed or its text could not be read. */
async function askModel(
  deps: AskDeps,
  model: TextModelProvider,
  held: Hold,
  input: AskInput,
  scope: AskScope,
  rules: readonly RetrievedRule[],
) {
  try {
    const reply = await model.complete({
      system: SYSTEM,
      user: userInput(input.question, rules, scope),
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      signal: deps.signal?.(),
    });
    return readReply(reply.text);
  } catch {
    // A call that did not answer is given back, and the rules are shown in their own words instead.
    await held.refund();
    return null;
  }
}

const FREE: Hold = { refund: async () => undefined };

/**
 * An answer the grader turned down. Its words are dropped and the rules the search found are offered in their
 * place; only the kinds of defect travel, never the sentence that held one.
 */
const ungrounded = (question: string, rules: readonly RetrievedRule[], grade: AskGrade): AskResult => ({
  kind: "ungrounded",
  question,
  message: UNGROUNDED,
  rules,
  defects: [...new Set(grade.defects.map((defect) => defect.kind))],
});

/** One question, answered out of the rulebook or not answered at all. */
export async function askRulebook(deps: AskDeps, input: AskInput): Promise<AskResult> {
  const scope = input.scope ?? {};
  const question = input.question;
  const rules = await retrieveRules(deps.retrieval, question, scope, deps.reader);
  if (rules.length === 0) return notCovered(deps, input, scope);
  if (!deps.model) return { kind: "unavailable", question, message: NO_MODEL, rules };

  const held = deps.reserve ? await deps.reserve(rules, question) : FREE;
  if (!held) return { kind: "unavailable", question, message: OVER_ALLOWANCE, rules };

  const reply = await askModel(deps, deps.model, held, input, scope, rules);
  if (!reply) return ungrounded(question, rules, gradeAnswer([], rules));
  if (!reply.covered) return notCovered(deps, input, scope);

  const grade = gradeAnswer(reply.sentences, rules);
  if (!grade.ok) return ungrounded(question, rules, grade);
  return { kind: "answer", question, sentences: reply.sentences, rules, grade };
}
