import { applyAction, type GarmentSpec, type SpecAction } from "@/lib/garment";
import { explainChanges } from "@/lib/intent/explain";
import type { Proposal, Verified } from "@/lib/intent/proposal-token";
import { encodeEvent, questionForBrowser, type StreamEvent } from "@/lib/intent/stream";
import { runTextIntent } from "@/lib/intent/text-flow";
import { MAX_OUTPUT_TOKENS, MAX_TEXT_INPUT_TOKENS, callCost, type ModelEntry } from "@/lib/providers/catalog";
import type { ModelChoice } from "@/lib/providers/select";
import { AppError } from "@/lib/server/core/errors";
import type { LogEvent } from "@/lib/server/core/guard";
import type { RouteUsage } from "@/lib/server/core/metered";
import type { Cost } from "@/lib/usage/cost";
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
  /** Signs the changes of one choice, for the browser to hand back. */
  readonly sign: (actions: readonly SpecAction[], explanations: readonly string[]) => string;
  readonly log: (event: LogEvent) => void;
  /** How long one model call may take. */
  readonly timeoutMs: number;
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

async function saved(outcome: Extract<Awaited<ReturnType<typeof runTextIntent>>["outcome"], { kind: "applied" }>, deps: TextRequestDeps): Promise<StreamEvent> {
  try {
    const result = await deps.save(outcome.actions, outcome.explanations);
    if (!result.ok) return { type: "outcome", outcome: { kind: "rejection", reason: result.reason } };
    return { type: "outcome", outcome: { kind: "applied", explanations: [...outcome.explanations], notes: [...outcome.notes], version: result.version } };
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
    emit({ type: "failed", message: ASSISTANT_FAILED });
    return;
  }
  // Nothing was asked of a model, so nothing is owed.
  if (result.calls.length === 0) await usage?.refund();
  const { outcome } = result;
  if (outcome.kind === "applied") emit(await saved(outcome, deps));
  else if (outcome.kind === "question") {
    emit({ type: "outcome", outcome: questionForBrowser(outcome, (actions) => deps.sign(actions, explainActions(spec, actions))) });
  } else emit({ type: "outcome", outcome });
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

export type ProposalSave = (input: {
  readonly expectedVersion: number;
  readonly actions: readonly SpecAction[];
  readonly source: Proposal["source"];
  readonly explanations: readonly string[];
}) => Promise<SaveOutcome>;

/** Applies a proposal the server signed, only at the version it was made for. */
export async function applySignedProposal({
  verify,
  save,
  expectedVersion,
}: {
  readonly verify: () => Verified;
  readonly save: ProposalSave;
  readonly expectedVersion: number;
}): Promise<{ ok: true; version: number } | { ok: false; reason: string }> {
  const verified = verify();
  if (!verified.ok) return verified;
  const { proposal } = verified;
  if (proposal.version !== expectedVersion) return { ok: false, reason: CHANGED_MEANWHILE };
  const result = await save({ expectedVersion, actions: proposal.actions, source: proposal.source, explanations: proposal.explanations });
  return result.ok ? { ok: true, version: result.version } : { ok: false, reason: result.reason };
}
