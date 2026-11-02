import { GENERATED_LABEL } from "@/lib/launch/assets";
import type { LogEvent } from "@/lib/server/core/guard";
import type { BoardVideoProvider, BoardVideoRequest } from "./board-provider";
import { checkClipFrames, type ClipCheckReport, type FrameCheckInput, type SampledFrame } from "./frame-check";
import { VIDEO_GAP_RULE } from "./formats";
import { MAX_CLIP_BYTES } from "./limits";
import { sniffVideo, type VideoType } from "./sniff";

/**
 * ONE PAID RUN OF AN AI VIDEO BOARD, AND THE MONEY AROUND IT (spec F-L3: "Generate shows the cost
 * first", "failed runs refund credits").
 *
 * The order matters and is the whole point of this file:
 *
 *   1. reserve the platform's own estimated spend from the usage meter (decision 0012), so a paid
 *      call cannot be made past a cap;
 *   2. charge the brand's credits, **only when charging is on**. `CREDITS_ENFORCED` is off today, so
 *      `ledger` is null and nothing is charged -- and the behaviour with it on is the one written
 *      here, not something to be added later;
 *   3. call the model;
 *   4. sample frames of what came back and run the picture checker on every one of them;
 *   5. **on any failure after the charge -- a refused call, a file that is not a video, a frame the
 *      checker turned away -- give the credits back and release the reservation.** A failed run costs
 *      the brand nothing, and the sentence the person reads says so.
 *
 * Every door out of this function goes through `settle`, so there is no path that spends and does not
 * refund. The test walks each of them.
 */

export interface RunLedger {
  /** Charges the clip once. The idempotency key makes a retry of the same run free. */
  spend(
    input: Readonly<{ credits: number; idempotencyKey: string }>,
  ): Promise<Readonly<{ ok: true; charged: boolean; balance: number }> | Readonly<{ ok: false; reason: "insufficient"; balance: number }>>;
  /** Gives back the credits of a run that failed. */
  refund(input: Readonly<{ credits: number; reason: string }>): Promise<Readonly<{ refunded: number; balance: number }>>;
}

export interface RunMeter {
  /** Reserves the platform's estimated spend. Refused when a cap is reached. */
  reserve(microdollars: number): Promise<Readonly<{ ok: true; eventId: string }> | Readonly<{ ok: false; refused: string }>>;
  /** Gives the reservation back. Called for every failure, and never for a success. */
  release(eventId: string): Promise<void>;
}

/** Takes frames out of a finished clip. The browser does this with a video element and a canvas. */
export type FrameSampler = (video: Uint8Array, atMs: readonly number[], type: VideoType) => Promise<readonly SampledFrame[]>;

export interface RunDeps {
  readonly provider: BoardVideoProvider;
  /** Null while `CREDITS_ENFORCED` is off: nothing is charged and nothing is refunded. */
  readonly ledger: RunLedger | null;
  readonly meter: RunMeter;
  readonly sample: FrameSampler;
  readonly log: (event: LogEvent) => void;
  readonly check?: typeof checkClipFrames;
}

export interface RunAsk {
  readonly request: BoardVideoRequest;
  /** The credits the panel showed on the button. Charged, never worked out again here. */
  readonly credits: number;
  /** One key per board and settings, so Regenerate of an unchanged board does not charge twice. */
  readonly idempotencyKey: string;
  /** The moments to sample, from the plan. */
  readonly sampleMs: readonly number[];
  readonly checkInput: Omit<FrameCheckInput, "frames" | "expected">;
}

export type RunOutcome =
  | Readonly<{
      ok: true;
      video: Uint8Array;
      type: VideoType;
      checker: ClipCheckReport;
      /** Credits this run really spent. Zero while charging is off. */
      spent: number;
      /** The words the spec puts on anything a model made. */
      label: typeof GENERATED_LABEL;
    }>
  | Readonly<{ ok: false; message: string; spent: 0; refunded: number; ruleId: string }>;

export const CAPPED_MESSAGE = "The platform has reached its own limit on paid video for now. Nothing was charged. Try again later.";
export const SHORT_MESSAGE = "You do not have enough credits for this clip, so nothing was run or charged.";
export const MODEL_FAILED_MESSAGE = "The model could not make this clip. The credits for it have been given back.";
export const NOT_A_VIDEO_MESSAGE = "What came back was not a video this studio can keep. The credits for it have been given back.";
export const TOO_LARGE_MESSAGE = "The clip came back too large to keep. The credits for it have been given back.";

type Spent = Readonly<{ eventId: string | null; credits: number }>;

/** The one way out for a failed run: release the reservation, give the credits back, say so. */
async function settle(deps: RunDeps, spent: Spent, message: string): Promise<RunOutcome> {
  if (spent.eventId) {
    await deps.meter.release(spent.eventId).catch((error: unknown) => deps.log({ level: "warn", message: "A video reservation could not be released", where: "video run", error }));
  }
  let refunded = 0;
  if (deps.ledger && spent.credits > 0) {
    const given = await deps.ledger
      .refund({ credits: spent.credits, reason: message })
      .catch((error: unknown) => {
        deps.log({ level: "error", message: "Credits for a failed video could not be given back", where: "video run", error });
        return { refunded: 0, balance: 0 };
      });
    refunded = given.refunded;
  }
  return { ok: false, message, spent: 0, refunded, ruleId: VIDEO_GAP_RULE };
}

/** Reserves the platform's own spend, then charges the brand. Either may refuse, and neither leaves a trace. */
async function take(deps: RunDeps, ask: RunAsk): Promise<Spent | RunOutcome> {
  const estimate = Math.max(1, Math.round(deps.provider.costPerSecondMicrodollars * ask.request.seconds));
  const reservation = await deps.meter.reserve(estimate);
  if (!reservation.ok) return { ok: false, message: CAPPED_MESSAGE, spent: 0, refunded: 0, ruleId: VIDEO_GAP_RULE };
  if (!deps.ledger) return { eventId: reservation.eventId, credits: 0 };
  const spend = await deps.ledger.spend({ credits: ask.credits, idempotencyKey: ask.idempotencyKey });
  if (!spend.ok) {
    await deps.meter.release(reservation.eventId).catch(() => undefined);
    return { ok: false, message: SHORT_MESSAGE, spent: 0, refunded: 0, ruleId: VIDEO_GAP_RULE };
  }
  return { eventId: reservation.eventId, credits: spend.charged ? ask.credits : 0 };
}

/** What the model gave back, checked as a file: the first bytes say what it is, never the model's word. */
function readVideo(video: Uint8Array): Readonly<{ ok: true; type: VideoType }> | Readonly<{ ok: false; message: string }> {
  const type = sniffVideo(video);
  if (!type) return { ok: false, message: NOT_A_VIDEO_MESSAGE };
  if (video.byteLength > MAX_CLIP_BYTES) return { ok: false, message: TOO_LARGE_MESSAGE };
  return { ok: true, type };
}

/** Runs the board. Never throws: every failure comes back as a sentence, with the money put right. */
export async function runAiVideo(deps: RunDeps, ask: RunAsk, signal: AbortSignal): Promise<RunOutcome> {
  const taken = await take(deps, ask);
  if ("ok" in taken) return taken;
  try {
    const made = await deps.provider.generate(ask.request, signal);
    if (!made.ok) return await settle(deps, taken, MODEL_FAILED_MESSAGE);
    const read = readVideo(made.video);
    if (!read.ok) return await settle(deps, taken, read.message);
    const frames = await deps.sample(made.video, ask.sampleMs, read.type);
    const checker = await (deps.check ?? checkClipFrames)({ ...ask.checkInput, frames, expected: ask.sampleMs.length });
    if (checker.verdict === "rejected") return await settle(deps, taken, checker.message ?? MODEL_FAILED_MESSAGE);
    return { ok: true, video: made.video, type: read.type, checker, spent: taken.credits, label: GENERATED_LABEL };
  } catch (error) {
    deps.log({ level: "error", message: "A video run failed", where: "video run", error });
    return await settle(deps, taken, MODEL_FAILED_MESSAGE);
  }
}
