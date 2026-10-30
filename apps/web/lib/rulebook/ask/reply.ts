import { z } from "zod";
import { extractJsonObject } from "@/lib/intent/extract-json";
import { RULE_ID } from "../constants";
import type { AskSentence } from "./types";

/**
 * Reading the model's reply (decision 0083). The reply is structured output: whether the rulebook covers the
 * question, and one entry per sentence with the ids it cites. It is untrusted text, so it is parsed, not
 * trusted: anything that does not fit the shape is read as no answer at all, and the caller then shows the rules
 * in the rulebook's own words rather than guessing what the model meant.
 */

/** The longest answer taken from a reply. Four sentences is what the instructions ask for; eight is the ceiling. */
export const MAX_SENTENCES = 8;

export const askReplySchema = z.object({
  covered: z.boolean(),
  sentences: z
    .array(
      z.object({
        text: z.string().trim().min(1).max(600),
        ruleIds: z.array(z.string().trim().toUpperCase().regex(RULE_ID)).max(8).default([]),
      }),
    )
    .max(MAX_SENTENCES)
    .default([]),
});

export type AskReply = Readonly<{ covered: boolean; sentences: readonly AskSentence[] }>;

/**
 * The reply, or null when it cannot be read. A reply that says the rulebook covers the question but holds no
 * sentence is read as not covered, because that is what it amounts to.
 */
export function readReply(text: string): AskReply | null {
  const parsed = askReplySchema.safeParse(extractJsonObject(text));
  if (!parsed.success) return null;
  const sentences = parsed.data.sentences.map((sentence) => ({ text: sentence.text, ruleIds: sentence.ruleIds }));
  return { covered: parsed.data.covered && sentences.length > 0, sentences };
}
