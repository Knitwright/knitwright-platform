import { z } from "zod";
import { PARTS } from "./best-practice";
import { MAX_QUESTION_LENGTH } from "./prompt";

/**
 * What the Ask box and the best-practice card send (decision 0083). A question is a person's own words, so it is
 * only measured, never read for meaning here; the scope is the design's base article and the way it is made, and
 * both are ids, not prose.
 */

const ARTICLE_CODE = /^[A-Z0-9]+(-[A-Z0-9]+)*$/;
const METHOD = /^[a-z][a-z0-9_]*$/;

const articleCode = z
  .string()
  .trim()
  .toUpperCase()
  .max(40)
  .regex(ARTICLE_CODE, "An article code looks like JSY-SS-01.")
  .optional();

const method = z.string().trim().toLowerCase().max(40).regex(METHOD, "A method looks like sublimation.").optional();

/** An empty field in a form means "not given", not an empty code. */
const blankIsMissing = (value: unknown): unknown => (typeof value === "string" && value.trim() === "" ? undefined : value);

export const askSchema = z.object({
  question: z
    .string()
    .trim()
    .min(3, "Write your question.")
    .max(MAX_QUESTION_LENGTH, `A question can be up to ${MAX_QUESTION_LENGTH} characters.`),
  articleCode: z.preprocess(blankIsMissing, articleCode),
  method: z.preprocess(blankIsMissing, method),
});

export type AskFormInput = z.output<typeof askSchema>;

export const PART_KEYS = PARTS.map((part) => part.key) as [string, ...string[]];

export const bestPracticeSchema = z.object({
  part: z.enum(PART_KEYS, "Choose a part."),
  articleCode: z.preprocess(blankIsMissing, articleCode),
  method: z.preprocess(blankIsMissing, method),
});
