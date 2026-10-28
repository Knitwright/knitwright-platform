import { applyAction, type GarmentSpec, type SpecAction } from "@/lib/garment";
import { explainChanges } from "@/lib/intent/explain";
import type { Proposal, Verified } from "@/lib/intent/proposal-token";
import { encodeEvent, followUpsForBrowser, questionForBrowser, type Sign, type StreamEvent } from "@/lib/intent/stream";
import { runTextIntent } from "@/lib/intent/text-flow";
import { MAX_OUTPUT_TOKENS, MAX_TEXT_INPUT_TOKENS, callCost, type ModelEntry } from "@/lib/providers/catalog";
import type { ModelChoice } from "@/lib/providers/select";
import { AppError } from "@/lib/server/core/errors";
import type { LogEvent } from "@/lib/server/core/guard";
import type { RouteUsage } from "@/lib/server/core/metered";
import type { Cost } from "@/lib/usage/cost";
import type { StoredLine } from "./chat";
import { choiceLines, exchangeLines } from "./chat-history";
import type { SaveOutcome } from "./service";

/**
 * The work behind the assistant's text route and the choice of a proposal, with every
 * outside service passed in, so it is tested without a network, a model or a database.
 */

export const ASSISTANT_FAILED = "The assistant could not answer just now. Nothing was changed. Try again in a moment.";
export const CHANGED_MEANWHILE = "The design changed while the assistant was working. Nothing was changed. Ask again.";

/** The most a text request can cost on a model: the input bound and the fixed output limit. */
export const textCost = (entry: ModelEntry): Cost => ({
  feature: "ai",
  microdollars: callCost(entry, MAX_TEXT_INPUT_TOKENS, MAX_OUTPUT_TOKENS),
});

export interface TextRequestDeps {
  /** The design as it is now, read for the brand in the session. */
  readonly spec: GarmentSpec;
  readonly models: ModelChoice;
  /** The route's reservation, or null when the request needs no model. */
  readonly usage: RouteUsage | null;
  /** Stores the assistant's changes as one version at the version the person was looking at. */
  readonly save: (actions: readonly SpecAction[], explanations: readonly string[]) => Promise<SaveOutcome>;
  /**
   * Signs the changes of one choice, for the browser to hand back, with the label the person
   * sees. A version of null is the one the person was looking at; a way on from a change that
   * was just saved is signed at the new version instead.
   */
  readonly sign: (actions: readonly SpecAction[], explanations: readonly string[], at: SignedAt) => string;
  /** Keeps the words and the answer with the design. Left out, nothing is kept (tests, evaluation). */
  readonly record?: (lines: readonly StoredLine[]) => Promise<void>;
  readonly log: (event: LogEvent) => void;
  /** How long one model call may take. */
  readonly timeoutMs: number;
}

export interface SignedAt {
  readonly version: number | null;
  readonly label: string;
}

const WHERE = "assistant text request";

/** The sentences a batch of changes would produce on this design, or none when it cannot be made. */
export function explainActions(spec: GarmentSpec, actions: readonly SpecAction[]): readonly string[] {
  let current = spec;
  for (const action of actions) {
    const result = applyAction(current, action);
    if (!result.ok) return [];
    current = result.spec;
  }
  return explainChanges(spec, current);
}

/** Signs one choice's changes on the design they apply to, at the version given. */
const signer =
  (deps: TextRequestDeps, base: GarmentSpec, version: number | null): Sign =>
  (actions, label) =>
    deps.sign(actions, explainActions(base, actions), { version, label });

async function saved(outcome: Extract<Awaited<ReturnType<typeof runTextIntent>>["outcome"], { kind: "applied" }>, deps: TextRequestDeps): Promise<StreamEvent> {
  try {
    const result = await deps.save(outcome.actions, outcome.explanations);
    if (!result.ok) return { type: "outcome", outcome: { kind: "rejection", reason: result.reason } };
    // The ways on apply to the design as just saved, so they are signed at its new version.
    const followUps = followUpsForBrowser(outcome.followUps, signer(deps, outcome.spec, result.version));
    return { type: "outcome", outcome: { kind: "applied", explanations: [...outcome.explanations], notes: [...outcome.notes], version: result.version, ...followUps } };
  } catch (error) {
    if (error instanceof AppError && error.code === "conflict") return { type: "outcome", outcome: { kind: "rejection", reason: CHANGED_MEANWHILE } };
    deps.log({ level: "error", message: "The assistant's change could not be saved", where: WHERE, error });
    return { type: "failed", message: ASSISTANT_FAILED };
  }
}

/** Answers one message, sending progress and then exactly one outcome or failure. */
export async function textRequestEvents(utterance: string, deps: TextRequestDeps, emit: (event: StreamEvent) => void): Promise<void> {
  const { spec, models, usage } = deps;
  const retryEntry = models.retry?.entry;
  let result: Awaited<ReturnType<typeof runTextIntent>>;
  try {
    result = await runTextIntent(
      { utterance, spec },
      {
        primary: models.primary?.provider ?? null,
        retry: models.retry?.provider ?? null,
        reserveRetry: usage && retryEntry ? () => usage.reserve(textCost(retryEntry)) : undefined,
        onStage: (stage) => emit({ type: "stage", stage }),
        signal: () => AbortSignal.timeout(deps.timeoutMs),
      },
    );
  } catch (error) {
    await usage?.refund();
    deps.log({ level: "error", message: "The assistant's model call failed", where: WHERE, error });
    await finish(utterance, { type: "failed", message: ASSISTANT_FAILED }, deps, emit);
    return;
  }
  // Nothing was asked of a model, so nothing is owed.
  if (result.calls.length === 0) await usage?.refund();
  await finish(utterance, await answerEvent(result.outcome, deps), deps, emit);
}

async function answerEvent(outcome: Awaited<ReturnType<typeof runTextIntent>>["outcome"], deps: TextRequestDeps): Promise<StreamEvent> {
  const here = signer(deps, deps.spec, null);
  switch (outcome.kind) {
    case "applied":
      return saved(outcome, deps);
    case "question":
      return { type: "outcome", outcome: questionForBrowser(outcome, here) };
    case "rejection":
      return { type: "outcome", outcome: { kind: "rejection", reason: outcome.reason, ...followUpsForBrowser(outcome.followUps, here) } };
  }
}

/** Sends the answer, then keeps it with the design. A failure to keep it never changes the answer. */
async function finish(utterance: string, event: StreamEvent, deps: TextRequestDeps, emit: (event: StreamEvent) => void): Promise<void> {
  emit(event);
  if (!deps.record) return;
  try {
    await deps.record(exchangeLines(utterance, event));
  } catch (error) {
    deps.log({ level: "error", message: "The conversation could not be kept", where: WHERE, error });
  }
}

/**
 * A streamed answer of JSON lines. Proxies are told not to hold it back
 * (`X-Accel-Buffering: no`). If the work throws, the last line is a plain failure.
 */
export function eventStream(work: (emit: (event: StreamEvent) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: StreamEvent) => controller.enqueue(encoder.encode(encodeEvent(event)));
      try {
        await work(emit);
      } catch {
        emit({ type: "failed", message: ASSISTANT_FAILED });
      }
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
      "x-content-type-options": "nosniff",
    },
  });
}

type ProposalSave = (input: {
  readonly expectedVersion: number;
  readonly actions: readonly SpecAction[];
  readonly source: Proposal["source"];
  readonly explanations: readonly string[];
}) => Promise<SaveOutcome>;

/** Said for a choice signed before choices carried their label. */
const CHOSEN = "Chosen";

/**
 * Applies a proposal the server signed, only at the version it was made for. A choice of the
 * assistant's is kept in the conversation; a reading of a picture is not part of it.
 */
export async function applySignedProposal({
  verify,
  save,
  expectedVersion,
  record,
  log,
}: {
  readonly verify: () => Verified;
  readonly save: ProposalSave;
  readonly expectedVersion: number;
  readonly record?: (lines: readonly StoredLine[]) => Promise<void>;
  readonly log?: (event: LogEvent) => void;
}): Promise<{ ok: true; version: number } | { ok: false; reason: string }> {
  const verified = verify();
  if (!verified.ok) return verified;
  const { proposal } = verified;
  if (proposal.version !== expectedVersion) return { ok: false, reason: CHANGED_MEANWHILE };
  const result = await save({ expectedVersion, actions: proposal.actions, source: proposal.source, explanations: proposal.explanations });
  if (!result.ok) return { ok: false, reason: result.reason };
  if (record && proposal.source === "assistant") {
    try {
      await record(choiceLines(proposal.label ?? CHOSEN, proposal.explanations));
    } catch (error) {
      log?.({ level: "error", message: "The conversation could not be kept", where: "assistant choice", error });
    }
  }
  return { ok: true, version: result.version };
}
