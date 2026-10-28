import { z } from "zod";
import type { SpecAction } from "@/lib/garment";
import type { FollowUp, IntentOutcome } from "./outcome";

/**
 * What the text route sends, one JSON object per line (plan step 12, task 4: the response
 * is streamed). The model's own text is never streamed: it is untrusted until parsed, so
 * the stream carries progress, then the outcome. A change that was made is already saved;
 * a question's choices carry signed proposals the browser hands back to apply one.
 */

const text = z.string().max(2000);

/** A way on as the browser sees it: changes as a signed proposal, or words to send or to finish. */
const followUpChoiceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("apply"), label: text, token: z.string() }),
  z.object({ kind: z.enum(["say", "fill"]), label: text, text }),
]);
type BrowserFollowUpChoice = z.output<typeof followUpChoiceSchema>;

const followUpsSchema = z.array(z.object({ text, choices: z.array(followUpChoiceSchema) })).optional();
export type BrowserFollowUp = NonNullable<z.output<typeof followUpsSchema>>[number];

export const browserOutcomeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("applied"), explanations: z.array(text), notes: z.array(text), version: z.number().int(), followUps: followUpsSchema }),
  z.object({
    kind: z.literal("question"),
    question: text,
    choices: z.array(z.object({ label: text, token: z.string().nullable() })),
    recommended: z.number().int(),
  }),
  z.object({ kind: z.literal("rejection"), reason: text, followUps: followUpsSchema }),
]);
export type BrowserOutcome = z.output<typeof browserOutcomeSchema>;

const eventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("stage"), stage: z.enum(["model", "retry"]) }),
  z.object({ type: z.literal("outcome"), outcome: browserOutcomeSchema }),
  z.object({ type: z.literal("failed"), message: text }),
]);
export type StreamEvent = z.output<typeof eventSchema>;

export const encodeEvent = (event: StreamEvent): string => `${JSON.stringify(event)}\n`;

/** One line of the stream as an event, or null when it is not one. */
export function parseEvent(line: string): StreamEvent | null {
  try {
    const parsed = eventSchema.safeParse(JSON.parse(line));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Whole lines so far, and the part of a line still waiting for the rest. */
export function splitLines(rest: string, piece: string): { lines: string[]; rest: string } {
  const parts = (rest + piece).split("\n");
  const last = parts.pop() ?? "";
  return { lines: parts.filter((line) => line.trim() !== ""), rest: last };
}

/** Signs the changes of one choice. The label goes with them, so the conversation can say what was chosen. */
export type Sign = (actions: readonly SpecAction[], label: string) => string;

/** A question as the browser sees it: each choice that changes something as a signed proposal. */
export function questionForBrowser(
  outcome: Extract<IntentOutcome, { kind: "question" }>,
  sign: Sign,
): Extract<BrowserOutcome, { kind: "question" }> {
  return {
    kind: "question",
    question: outcome.question,
    choices: outcome.choices.map((choice) => ({ label: choice.label, token: choice.actions.length > 0 ? sign(choice.actions, choice.label) : null })),
    recommended: outcome.recommended,
  };
}

/**
 * The ways on as the browser sees them, or nothing to add when there are none. Changes are
 * signed against the version they apply to, the one saved with the rest of the request.
 */
export function followUpsForBrowser(followUps: readonly FollowUp[] | undefined, sign: Sign): { followUps?: BrowserFollowUp[] } {
  if (!followUps || followUps.length === 0) return {};
  return {
    followUps: followUps.map((followUp) => ({
      text: followUp.text,
      choices: followUp.choices.map(
        (choice): BrowserFollowUpChoice =>
          choice.kind === "apply" ? { kind: "apply", label: choice.label, token: sign(choice.actions, choice.label) } : choice,
      ),
    })),
  };
}
