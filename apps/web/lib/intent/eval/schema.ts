import { z } from "zod";

/**
 * The intake test set (plan v4, V8). A prompt is what a person types to start a design. The
 * expected answer is one of three things: an article from the registry, a plain "we do not
 * make that" with the nearest block and the difference in one line, or a question because
 * more than one article fits.
 */

export const CATEGORIES = ["direct", "kit-wording", "australian", "typo", "partial", "ambiguous", "set", "out-of-catalogue", "pending", "colour"] as const;
export type Category = (typeof CATEGORIES)[number];

/** The spec's acceptance mark for stage 1: this share of the prompts map to the right article. */
export const ARTICLE_TARGET = 0.95;

/** The spec's mark for a jersey photo to be read, in milliseconds. Applied to every call here. */
export const LATENCY_BUDGET_MS = 10_000;

const hex = z.string().regex(/^#[0-9a-f]{6}$/);
const articleId = z.string().min(1);

export const expectedSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("article"), articleId }),
  z.strictObject({
    kind: z.literal("out-of-catalogue"),
    /** The block nearest in the registry today, null when none is, and what differs, in one line. */
    nearest: z.strictObject({ articleId: articleId.nullable(), difference: z.string().min(1) }),
  }),
  z.strictObject({ kind: z.literal("ambiguous"), candidates: z.array(articleId).min(2) }),
]);
export type Expected = z.output<typeof expectedSchema>;

export const caseSchema = z.strictObject({
  id: z.string().min(1),
  category: z.enum(CATEGORIES),
  prompt: z.string().min(1).max(500),
  expected: expectedSchema,
  /** The colours the prompt names, in the order written. */
  colours: z.array(hex).optional(),
  /** The article the right answer needs from the football and cricket catalogue (V2), which is not merged yet. */
  pending_catalogue: z.strictObject({ articleId }).optional(),
});
export type EvalCase = z.output<typeof caseSchema>;

export const fixtureSchema = z.strictObject({
  status: z.enum(["proposed", "approved"]),
  note: z.string(),
  cases: z.array(caseSchema),
});

/** What a reader of the prompt decided. */
export type Prediction =
  | { readonly kind: "article"; readonly articleId: string }
  | { readonly kind: "ambiguous"; readonly candidates: readonly string[] }
  | { readonly kind: "decline"; readonly nearest?: { readonly articleId: string | null; readonly difference: string } };

/** One reading of a prompt, with what it took. */
export interface Observation {
  readonly prediction: Prediction;
  /** Colours found, as lower case hex codes. */
  readonly colours: readonly string[];
  readonly latencyMs: number;
  readonly costMicrodollars: number;
  /** Set when the call or the reply failed. The prediction is then ignored. */
  readonly failed?: string;
}

/** Reads one prompt. */
export type Observer = (prompt: string) => Promise<Observation>;
