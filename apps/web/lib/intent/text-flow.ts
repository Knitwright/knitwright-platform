import type { GarmentSpec } from "@/lib/garment";
import { MAX_OUTPUT_TOKENS } from "@/lib/providers/catalog";
import type { ModelUsage, TextModelProvider } from "@/lib/providers/text-model";
import { NOTHING_CHANGED } from "./batch";
import { OVERRIDE_REASON, looksLikeOverride } from "./injection";
import { buildModelInput, type ModelInput } from "./model-input";
import { rejection, type IntentOutcome } from "./outcome";
import { UNREADABLE, resolveIntent } from "./resolve";
import { ruleReply } from "./rules";

/**
 * One text request from start to outcome (plan step 12, task 3): the guard, then the
 * rules, then the configured model, then one retry on a stronger model before a question
 * is asked. Providers are passed in, so tests use stubs and no network is touched here.
 */

/** The longest message accepted. The route refuses anything longer before it is read. */
export const MAX_UTTERANCE_LENGTH = 500;

export const UNAVAILABLE_REASON = `The assistant is not switched on yet, so only short requests that name a choice work, such as "slim fit" or "long sleeves". ${NOTHING_CHANGED}`;

export type Stage = "model" | "retry";

export type AnsweredBy = "guard" | "rules" | "unavailable" | "model" | "retry";

export interface ModelCall {
  readonly model: string;
  readonly usage: ModelUsage;
}

export interface TextFlowResult {
  readonly outcome: IntentOutcome;
  readonly answeredBy: AnsweredBy;
  readonly calls: readonly ModelCall[];
}

/** A reservation for the retry's cost. Given back if the retry fails. */
export interface RetryReservation {
  refund(): Promise<void>;
}

export interface TextFlowDeps {
  readonly primary: TextModelProvider | null;
  readonly retry: TextModelProvider | null;
  /** Reserves the retry's cost. Null means the allowance refused it. Left out, the retry is free (tests, evaluation). */
  readonly reserveRetry?: () => Promise<RetryReservation | null>;
  readonly onStage?: (stage: Stage) => void;
  /** Stops a call that takes too long. */
  readonly signal?: () => AbortSignal | undefined;
}

/** True when the request is answered without a model, so it costs nothing. Pure. */
export const answeredWithoutModel = (utterance: string): boolean => looksLikeOverride(utterance) || ruleReply(utterance) !== null;

const isUnreadable = (outcome: IntentOutcome): boolean => outcome.kind === "rejection" && outcome.reason === UNREADABLE;

/** An outcome another model might improve on: a question, or a reply that could not be read. */
const worthRetrying = (outcome: IntentOutcome): boolean => outcome.kind === "question" || isUnreadable(outcome);

async function ask(provider: TextModelProvider, input: ModelInput, deps: TextFlowDeps) {
  const reply = await provider.complete({ ...input, maxOutputTokens: MAX_OUTPUT_TOKENS, signal: deps.signal?.() });
  return { text: reply.text, call: { model: reply.model, usage: reply.usage } };
}

async function retried(
  first: { outcome: IntentOutcome; call: ModelCall },
  retry: TextModelProvider,
  context: { utterance: string; spec: GarmentSpec; input: ModelInput },
  deps: TextFlowDeps,
): Promise<TextFlowResult> {
  const kept: TextFlowResult = { outcome: first.outcome, answeredBy: "model", calls: [first.call] };
  const reservation = deps.reserveRetry ? await deps.reserveRetry() : { refund: async () => undefined };
  if (!reservation) return kept;
  deps.onStage?.("retry");
  let second: Awaited<ReturnType<typeof ask>>;
  try {
    second = await ask(retry, context.input, deps);
  } catch {
    await reservation.refund();
    return kept;
  }
  const outcome = resolveIntent({ utterance: context.utterance, spec: context.spec, raw: second.text });
  const calls = [first.call, second.call];
  return isUnreadable(outcome) ? { ...kept, calls } : { outcome, answeredBy: "retry", calls };
}

/**
 * Turns one message into one outcome. A failure of the first model call is thrown, so the
 * route can give its cost back; a failure of the retry keeps the first answer.
 */
export async function runTextIntent(
  { utterance, spec }: { readonly utterance: string; readonly spec: GarmentSpec },
  deps: TextFlowDeps,
): Promise<TextFlowResult> {
  if (looksLikeOverride(utterance)) return { outcome: rejection(OVERRIDE_REASON), answeredBy: "guard", calls: [] };
  const rule = ruleReply(utterance, spec);
  if (rule) return { outcome: resolveIntent({ utterance, spec, raw: JSON.stringify(rule) }), answeredBy: "rules", calls: [] };
  if (!deps.primary) return { outcome: rejection(UNAVAILABLE_REASON), answeredBy: "unavailable", calls: [] };

  const input = buildModelInput({ utterance, spec });
  deps.onStage?.("model");
  const first = await ask(deps.primary, input, deps);
  const outcome = resolveIntent({ utterance, spec, raw: first.text });
  if (!worthRetrying(outcome) || !deps.retry) return { outcome, answeredBy: "model", calls: [first.call] };
  return retried({ outcome, call: first.call }, deps.retry, { utterance, spec, input }, deps);
}
