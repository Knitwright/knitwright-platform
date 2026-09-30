import { getType, listTypes, type GarmentSpec, type SpecAction } from "@/lib/garment";
import { applyBatch, NOTHING_CHANGED, readActions, type BatchResult } from "./batch";
import { extractJsonObject } from "./extract-json";
import { explainChanges } from "./explain";
import { unstatedChanges } from "./gates";
import { numberProblem } from "./numbers";
import { rejection, type IntentOutcome, type QuestionChoice } from "./outcome";
import { replySchema, type Reply, type WireAction } from "./reply-schema";

/** A longer reply is refused unread. A real reply is a few hundred characters. */
export const MAX_REPLY_LENGTH = 20_000;

export const UNREADABLE = `The assistant's reply could not be read. ${NOTHING_CHANGED} Try saying it another way.`;
const ALREADY = `The design already has that. ${NOTHING_CHANGED}`;

export interface IntentInput {
  /** The person's words, exactly as sent to the model. */
  readonly utterance: string;
  /** The design the model was shown. */
  readonly spec: GarmentSpec;
  /** The model's reply, untrusted. */
  readonly raw: string;
}

export function readReply(raw: string): Reply | null {
  if (raw.length > MAX_REPLY_LENGTH) return null;
  const parsed = replySchema.safeParse(extractJsonObject(raw));
  return parsed.success ? parsed.data : null;
}

const actionsOf = (batch: Extract<BatchResult, { ok: true }>): SpecAction[] => batch.steps.map((step) => step.action);
const article = (label: string): string => (/^[aeiou]/i.test(label) ? `an ${label}` : `a ${label}`);

/**
 * When a type lacks the choice asked for, the other types of its family that offer it and
 * can take the whole request. The person picks one, or keeps the type they have.
 */
function otherTypesQuestion(
  spec: GarmentSpec,
  actions: readonly WireAction[],
  failed: { readonly wire: WireAction; readonly spec: GarmentSpec },
): IntentOutcome | null {
  const { wire } = failed;
  if (wire.type !== "set-option") return null;
  const type = getType(spec.typeId);
  const current = getType(failed.spec.typeId);
  if (!type || !current) return null;
  const offered = current.options.some((option) => option.id === wire.optionId && option.choices.some((choice) => choice.id === wire.choiceId));
  // A choice the type offers failed for another reason, such as a clash. Another type would not help.
  if (offered) return null;
  return typesOffering(spec, type, actions, wire);
}

function typesOffering(
  spec: GarmentSpec,
  type: NonNullable<ReturnType<typeof getType>>,
  actions: readonly WireAction[],
  failed: Extract<WireAction, { type: "set-option" }>,
): IntentOutcome | null {
  const rest = actions.filter((action) => action.type !== "change-type");
  const choices: QuestionChoice[] = listTypes(type.family)
    .filter((other) => other.id !== type.id && other.wearers.includes(spec.wearer))
    .filter((other) => other.options.some((option) => option.id === failed.optionId && option.choices.some((choice) => choice.id === failed.choiceId)))
    .flatMap((other) => {
      const batch = applyBatch(spec, [{ type: "change-type", typeId: other.id }, ...rest]);
      return batch.ok ? [{ label: `Change to ${other.label}`, actions: actionsOf(batch) }] : [];
    });
  if (choices.length === 0) return null;
  const option = [...type.options, ...listTypes(type.family).flatMap((other) => other.options)].find((entry) => entry.id === failed.optionId);
  const choice = option ? [...option.choices, ...option.notOffered].find((entry) => entry.id === failed.choiceId) : undefined;
  return {
    kind: "question",
    question: `${article(type.label)} does not come with ${choice?.label ?? failed.choiceId} for ${option?.label ?? failed.optionId}. Change the garment type?`,
    choices: [...choices, { label: `Keep it as ${article(type.label)}`, actions: [] }],
    recommended: 0,
  };
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Applies a batch the person asked for, asking first about anything they did not name. */
function resolveChanges(utterance: string, spec: GarmentSpec, raw: readonly unknown[]): IntentOutcome {
  const read = readActions(raw);
  if (!read.ok) return rejection(read.reason);
  const numbers = numberProblem(utterance, spec, read.actions);
  if (numbers) return rejection(numbers);
  const batch = applyBatch(spec, read.actions);
  if (!batch.ok) {
    return (batch.failed && otherTypesQuestion(spec, read.actions, batch.failed)) ?? rejection(batch.reason);
  }
  const explanations = explainChanges(spec, batch.spec);
  if (explanations.length === 0) return rejection(ALREADY);
  const gated = unstatedChanges(utterance, batch.steps);
  if (gated.phrases.length === 0) {
    return { kind: "applied", spec: batch.spec, actions: actionsOf(batch), explanations, notes: batch.notes };
  }
  const others = applyBatch(
    spec,
    batch.steps.filter((step) => !gated.steps.includes(step)).map((step) => step.wire),
  );
  const keep = others.ok && explainChanges(spec, others.spec).length > 0 ? actionsOf(others) : [];
  return {
    kind: "question",
    question: `${capitalise(`this would change ${gated.phrases.join(", and ")}.`)} You did not ask for that outright. Make the change?`,
    choices: [
      { label: "Yes, make the change", actions: actionsOf(batch) },
      { label: keep.length > 0 ? "No, only make the other changes" : "No, leave the design as it is", actions: keep },
    ],
    recommended: 0,
  };
}

type ModelChoice = Extract<Reply, { kind: "question" }>["choices"][number];

/**
 * A model's choice as the person can pick it, or null when it breaks a rule a change must keep:
 * it cannot be made, it holds a number the person did not type (numbers come only from their
 * own words, never from the model's label), or it changes the garment type, wearer or
 * construction without its label naming that change, the words the person agrees to.
 */
function checkedChoice(utterance: string, spec: GarmentSpec, choice: ModelChoice): QuestionChoice | null {
  const read = readActions(choice.actions);
  if (!read.ok || numberProblem(utterance, spec, read.actions)) return null;
  const batch = applyBatch(spec, read.actions);
  if (!batch.ok) return null;
  if (unstatedChanges(`${utterance}\n${choice.label}`, batch.steps).phrases.length > 0) return null;
  return { label: choice.label, actions: actionsOf(batch) };
}

/**
 * Passes on a model's question with only the choices that pass the same checks as a change.
 * With fewer than two left it is no longer a choice, so the question is passed on as words
 * alone, with nothing to apply.
 */
function resolveQuestion(utterance: string, spec: GarmentSpec, reply: Extract<Reply, { kind: "question" }>): IntentOutcome {
  const checked = reply.choices.map((choice) => checkedChoice(utterance, spec, choice));
  const choices = checked.filter((choice): choice is QuestionChoice => choice !== null);
  if (choices.length < 2) return rejection(`${reply.question} ${NOTHING_CHANGED}`);
  const picked = checked[reply.recommended];
  return { kind: "question", question: reply.question, choices, recommended: picked ? choices.indexOf(picked) : 0 };
}

/**
 * Turns a model's reply to one instruction into exactly one outcome: changes applied and
 * explained, a question, or a reason nothing changed (criterion M2). Model output is
 * parsed, never trusted, and this never throws.
 */
export function resolveIntent({ utterance, spec, raw }: IntentInput): IntentOutcome {
  const reply = readReply(raw);
  if (!reply) return rejection(UNREADABLE);
  switch (reply.kind) {
    case "changes":
      return resolveChanges(utterance, spec, reply.actions);
    case "question":
      return resolveQuestion(utterance, spec, reply);
    case "rejection":
      return rejection(reply.reason);
  }
}
