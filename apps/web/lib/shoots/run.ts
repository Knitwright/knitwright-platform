import { GENERATED_LABEL, GENERATED_PERSON_LABEL, type SceneAsset } from "@/lib/launch/assets";
import type { RunLedger, RunMeter } from "@/lib/media/video/run";
import type { LogEvent } from "@/lib/server/core/guard";
import type { Verdict } from "@/lib/moderation/types";
import { ATTEMPTS_ALLOWED, REFUNDED_LINE, checkShootResult, driftMessage, shouldRetry, type ShootCheckInput, type ShootCheckReport } from "./check";
import { refundReason } from "./cost";
import type { ShootProvider, ShootRequest } from "./provider";
import { SHOOT_GAP_RULE } from "./types";

/**
 * ONE PAID SHOOT, AND THE MONEY AROUND IT (spec F-L1's rules: "Failed generations refund credits",
 * and the platform's own rule that money is honest).
 *
 * The order is the whole point of this file, and it is L5's order for a clip (`lib/media/video/run.ts`)
 * because the two runs have the same obligations:
 *
 *   1. reserve the platform's own estimated spend from the usage meter (decision 0012), so a paid
 *      call cannot be made past a cap;
 *   2. charge the brand's credits, **only when charging is on**. `CREDITS_ENFORCED` is off today, so
 *      `ledger` is null and nothing is charged -- and the behaviour with it on is the one written
 *      here, not something to be added later;
 *   3. call the model;
 *   4. screen what came back through X8's generation hook, picture and prompt together;
 *   5. measure the garment against the render with `lib/media-check`. **One automatic second attempt
 *      when it is turned away** (F-L1), and the second attempt costs the brand nothing more: the
 *      credit key is the same, so the ledger cannot charge twice;
 *   6. **on any failure after the charge -- a refused call, a blocked picture, a garment that drifted
 *      twice -- give the credits back and release every reservation.** A failed shoot costs the brand
 *      nothing, and the sentence the person reads says so.
 *
 * Every door out of this function goes through `settle`, so there is no path that spends and does not
 * refund. The test walks each of them.
 */

/** X8's generation hook, as this file needs it (`lib/moderation/hooks.ts`, `screenGeneration`). */
export type ScreenGeneration = (input: Readonly<{ generationId: string; image: Uint8Array; prompt: string }>) => Promise<Verdict>;

export interface ShootRunDeps {
  readonly provider: ShootProvider;
  /** Null while `CREDITS_ENFORCED` is off: nothing is charged and nothing is refunded. */
  readonly ledger: RunLedger | null;
  readonly meter: RunMeter;
  /** X8's `screenGeneration`, bound to the brand and the person. */
  readonly screen: ScreenGeneration;
  readonly log: (event: LogEvent) => void;
  readonly check?: typeof checkShootResult;
}

export interface ShootRunAsk {
  readonly request: ShootRequest;
  /** The credits the panel showed on the button. Charged, never worked out again here. */
  readonly credits: number;
  /** One key per board and settings, so Regenerate of an unchanged shoot does not charge twice. */
  readonly idempotencyKey: string;
  /** The row this run is recorded against, which the moderation result is kept against too. */
  readonly jobId: string;
  readonly checkInput: Omit<ShootCheckInput, "generated">;
  /** True when a person will be in the picture, which decides the label the spec puts on it. */
  readonly showsPerson: boolean;
  /** A different seed per attempt, so the automatic retry is a new attempt and not the same one. */
  readonly seedFor: (attempt: number) => number;
}

export type ShootRunOutcome =
  | Readonly<{
      ok: true;
      png: Uint8Array;
      checker: ShootCheckReport;
      moderation: Verdict;
      /** How many attempts it took: 1, or 2 when the first was turned away. */
      attempts: number;
      /** Credits this run really spent. Zero while charging is off. */
      spent: number;
      /** The words the spec puts on anything a model made, and on a person it drew. */
      label: typeof GENERATED_LABEL | typeof GENERATED_PERSON_LABEL;
      ruleId: string;
    }>
  | Readonly<{ ok: false; message: string; attempts: number; spent: 0; refunded: number; ruleId: string }>;

export const CAPPED_MESSAGE = "The platform has reached its own limit on paid pictures for now. Nothing was charged. Try again later.";
/**
 * The same cap, reached between the two attempts. It cannot say "nothing was charged", because by
 * then something was: `settle` adds what happened to it.
 */
export const CAPPED_RETRY_MESSAGE = "The platform has reached its own limit on paid pictures for now, so this shoot was not finished. Try again later.";
export const SHORT_MESSAGE = "You do not have enough credits for this shoot, so nothing was run or charged.";
export const MODEL_FAILED_MESSAGE = "The model could not make this picture. The credits for it have been given back.";
export const BLOCKED_MESSAGE = "This picture cannot be kept: our review refused it. The credits for it have been given back.";

type Spent = { readonly eventIds: readonly string[]; readonly credits: number };

/** The words every message that mentions the refund already uses, so none of them says it twice. */
const GIVEN_BACK = "given back";

/** The label the spec puts on a result: a person in it is labelled more strictly again (F-L1). */
export const labelFor = (showsPerson: boolean): typeof GENERATED_LABEL | typeof GENERATED_PERSON_LABEL =>
  showsPerson ? GENERATED_PERSON_LABEL : GENERATED_LABEL;

/** The one way out for a failed run: release every reservation, give the credits back, say so. */
async function settle(deps: ShootRunDeps, spent: Spent, message: string, attempts: number): Promise<ShootRunOutcome> {
  for (const eventId of spent.eventIds) {
    await deps.meter
      .release(eventId)
      .catch((error: unknown) => deps.log({ level: "warn", message: "A shoot reservation could not be released", where: "shoot run", error }));
  }
  let refunded = 0;
  if (deps.ledger && spent.credits > 0) {
    const given = await deps.ledger.refund({ credits: spent.credits, reason: message }).catch((error: unknown) => {
      deps.log({ level: "error", message: "Credits for a failed shoot could not be given back", where: "shoot run", error });
      return { refunded: 0, balance: 0 };
    });
    refunded = given.refunded;
  }
  // Whatever went wrong, the sentence the person reads says what happened to the money. Several of
  // the messages above say it themselves; the checker's own sentence is F-L1's words and does not,
  // so the refund line is added to any message that has not said it already.
  const said = refunded > 0 && !message.includes(GIVEN_BACK) ? `${message} ${REFUNDED_LINE}` : message;
  return { ok: false, message: said, attempts, spent: 0, refunded, ruleId: SHOOT_GAP_RULE };
}

/** Reserves the platform's own spend for one model call. Refused when a cap is reached. */
async function reserve(deps: ShootRunDeps): Promise<Readonly<{ ok: true; eventId: string }> | Readonly<{ ok: false }>> {
  const estimate = Math.max(1, Math.round(deps.provider.costPerImageMicrodollars));
  const answer = await deps.meter.reserve(estimate);
  return answer.ok ? { ok: true, eventId: answer.eventId } : { ok: false };
}

/** Reserves, then charges the brand. Either may refuse, and neither leaves a trace when it does. */
async function take(deps: ShootRunDeps, ask: ShootRunAsk): Promise<Spent | ShootRunOutcome> {
  const first = await reserve(deps);
  if (!first.ok) return { ok: false, message: CAPPED_MESSAGE, attempts: 0, spent: 0, refunded: 0, ruleId: SHOOT_GAP_RULE };
  if (!deps.ledger) return { eventIds: [first.eventId], credits: 0 };
  const spend = await deps.ledger.spend({ credits: ask.credits, idempotencyKey: ask.idempotencyKey });
  if (!spend.ok) {
    await deps.meter.release(first.eventId).catch(() => undefined);
    return { ok: false, message: SHORT_MESSAGE, attempts: 0, spent: 0, refunded: 0, ruleId: SHOOT_GAP_RULE };
  }
  return { eventIds: [first.eventId], credits: spend.charged ? ask.credits : 0 };
}

type Attempt =
  | Readonly<{ kept: true; png: Uint8Array; checker: ShootCheckReport; moderation: Verdict }>
  | Readonly<{ kept: false; message: string; retry: boolean }>;

/** One attempt: the model, then the screen, then the checker. Nothing is kept that skipped one. */
async function attemptOnce(deps: ShootRunDeps, ask: ShootRunAsk, attempt: number, signal: AbortSignal): Promise<Attempt> {
  const made = await deps.provider.generate({ ...ask.request, seed: ask.seedFor(attempt) }, signal);
  if (!made.ok) return { kept: false, message: MODEL_FAILED_MESSAGE, retry: false };
  const moderation = await deps.screen({ generationId: ask.jobId, image: made.png, prompt: ask.request.prompt });
  if (moderation.result === "blocked") return { kept: false, message: BLOCKED_MESSAGE, retry: false };
  const checker = await (deps.check ?? checkShootResult)({ ...ask.checkInput, generated: made.png });
  if (checker.verdict === "turned_away") {
    return { kept: false, message: checker.message ?? driftMessage(true), retry: shouldRetry(checker, attempt) };
  }
  return { kept: true, png: made.png, checker, moderation };
}

/**
 * Runs one shoot. Never throws: every failure comes back as a sentence a person can act on, with the
 * money put right. The automatic second attempt reserves the platform's spend again, because that
 * call really costs the platform, and charges the brand nothing, because the person asked for one
 * picture.
 */
export async function runShoot(deps: ShootRunDeps, ask: ShootRunAsk, signal: AbortSignal): Promise<ShootRunOutcome> {
  const taken = await take(deps, ask);
  if ("ok" in taken) return taken;
  let spent = taken;
  let last = "";
  for (let attempt = 1; attempt <= ATTEMPTS_ALLOWED; attempt += 1) {
    if (attempt > 1) {
      const again = await reserve(deps);
      if (!again.ok) return await settle(deps, spent, CAPPED_RETRY_MESSAGE, attempt - 1);
      spent = { eventIds: [...spent.eventIds, again.eventId], credits: spent.credits };
    }
    let outcome: Attempt;
    try {
      outcome = await attemptOnce(deps, ask, attempt, signal);
    } catch (error) {
      deps.log({ level: "error", message: "A shoot failed", where: "shoot run", error });
      return await settle(deps, spent, MODEL_FAILED_MESSAGE, attempt);
    }
    if (outcome.kept) {
      return {
        ok: true,
        png: outcome.png,
        checker: outcome.checker,
        moderation: outcome.moderation,
        attempts: attempt,
        spent: spent.credits,
        label: labelFor(ask.showsPerson),
        ruleId: SHOOT_GAP_RULE,
      };
    }
    last = outcome.message;
    if (!outcome.retry) return await settle(deps, spent, last, attempt);
  }
  return await settle(deps, spent, driftMessage(true), ATTEMPTS_ALLOWED);
}

/**
 * The finished picture as something the launch shell will take (`offerAsset`, decision 0091).
 *
 * This is the only way this workstream hands a generated picture to the shell, and its return type
 * is `SceneAsset`, whose `role` is the literal `"scene"`. **A picture a model made therefore cannot
 * be written down as a panel layer or a print file**: spec decision 13 holds here by the type, not
 * by a reviewer remembering it, and `asset.test.ts` watches the door shut.
 */
export function shootSceneAsset(file: Readonly<{ fileId: string; contentType: string }>, showsPerson: boolean): SceneAsset {
  return { role: "scene", provenance: "generated", file, label: GENERATED_LABEL, showsPerson };
}

/** The words shown beside a result, which say more when there is a person in the picture. */
export const resultLabel = (asset: SceneAsset): string => (asset.showsPerson ? GENERATED_PERSON_LABEL : GENERATED_LABEL);

/** What the ledger line says for a refund, so the screen and the ledger read the same. */
export const refundNote = (count: number): string => refundReason(count);
