import type { View } from "@/lib/flat/model";
import type { GenerationGate } from "@/lib/moderation/gate";
import { ProviderError, type GeneratedImage, type ImageProvider, type ImageRequest } from "@/lib/providers";
import { AppError } from "@/lib/server/core/errors";
import type { LogEvent } from "@/lib/server/core/guard";

/**
 * The work of one photoreal job, run after the response with `after()`. Plan step 14,
 * tasks 3 and 4. Both views are made, then both are stored, then the job is marked done.
 * On any failure the job is marked failed and the reservation is given back, and any picture
 * already stored is removed again, so no file is left that no job points at (the design may
 * have been deleted, or the job stopped as stale, while the pictures were being made). It
 * never throws: nothing is waiting for it.
 */

/** Within the 60 seconds a request may run (decision record 0002), with room to store. */
const JOB_TIME_LIMIT_MS = 50_000;

export const FAILED_MESSAGE = "The images could not be made. The cost has been given back. Try again.";
export const UNAVAILABLE_MESSAGE =
  "Photoreal images are not available right now. The cost has been given back.";
/** Said when the content review refuses what the model made. The cost goes back, as for any failure. */
export const BLOCKED_MESSAGE =
  "The pictures the model made were refused by the content review, so they have not been kept. The cost has been given back.";

export interface JobStore {
  markRunning(jobId: string): Promise<void>;
  markSucceeded(jobId: string, files: Readonly<{ front: string; back: string }>): Promise<void>;
  markFailed(jobId: string, message: string): Promise<void>;
}

/** Refused by the content review. Carried as its own error so `failureMessage` can name it. */
export class BlockedByReview extends Error {
  constructor() {
    super(BLOCKED_MESSAGE);
    this.name = "BlockedByReview";
  }
}

export interface RunJobDeps {
  readonly provider: ImageProvider;
  readonly jobs: JobStore;
  /**
   * X8's `screenGeneration`, bound to the brand and the person (`lib/moderation/gate.ts`). The spec
   * asks for a screen on every AI generation, and this is one; a blocked picture is never stored
   * (H3 of the v5 security review, decision 0116).
   */
  readonly screen: GenerationGate;
  /** Checks and stores one picture. Returns its file id. */
  readonly saveImage: (view: View, image: GeneratedImage) => Promise<string>;
  /** Removes stored pictures, their objects and their rows, when the job cannot keep them. */
  readonly removeImages: (fileIds: readonly string[]) => Promise<void>;
  readonly refund: (eventId: string) => Promise<boolean>;
  readonly log: (event: LogEvent) => void;
  readonly timeoutMs?: number;
}

interface JobWork {
  readonly jobId: string;
  readonly eventId: string;
  readonly requests: Readonly<Record<"front" | "back", ImageRequest>>;
}

const WHERE = "photoreal job";

/** What the person is told. A full brand storage says so, since trying again will not help. */
const failureMessage = (error: unknown): string => {
  if (error instanceof BlockedByReview) return BLOCKED_MESSAGE;
  if (error instanceof ProviderError && error.refused) return UNAVAILABLE_MESSAGE;
  if (error instanceof AppError && error.code === "over_quota") return `${error.message} The cost has been given back.`;
  return FAILED_MESSAGE;
};

const attempt = async (deps: RunJobDeps, what: string, run: () => Promise<unknown>): Promise<void> => {
  try {
    await run();
  } catch (error) {
    deps.log({ level: "error", message: what, where: WHERE, error });
  }
};

async function make(deps: RunJobDeps, work: JobWork): Promise<void> {
  const signal = AbortSignal.timeout(deps.timeoutMs ?? JOB_TIME_LIMIT_MS);
  await deps.jobs.markRunning(work.jobId);
  // Both at once, so the job fits in one request's time.
  const [front, back] = await Promise.all([
    deps.provider.generate(work.requests.front, signal),
    deps.provider.generate(work.requests.back, signal),
  ]);
  // The screen comes between the model and the store, so nothing the review blocks is ever kept
  // (spec F-G1 "on every AI generation"; H3). Both views are screened, because either could be the
  // one the model got wrong, and the job's own row is what the result is kept against.
  for (const [view, image] of [["front", front], ["back", back]] as const) {
    const verdict = await deps.screen({ generationId: work.jobId, image: image.bytes, prompt: work.requests[view].prompt });
    if (verdict.result === "blocked") throw new BlockedByReview();
  }
  const saved: string[] = [];
  try {
    for (const [view, image] of [["front", front], ["back", back]] as const) saved.push(await deps.saveImage(view, image));
    const [frontFile = "", backFile = ""] = saved;
    await deps.jobs.markSucceeded(work.jobId, { front: frontFile, back: backFile });
  } catch (error) {
    if (saved.length > 0) {
      await attempt(deps, "The pictures of a failed photoreal job could not be removed", () => deps.removeImages(saved));
    }
    throw error;
  }
}

export async function runImageJob(deps: RunJobDeps, work: JobWork): Promise<"succeeded" | "failed"> {
  try {
    await make(deps, work);
    return "succeeded";
  } catch (error) {
    deps.log({ level: "error", message: `Photoreal images failed (${deps.provider.name})`, where: WHERE, error });
    const message = failureMessage(error);
    await attempt(deps, "A failed photoreal job could not be marked failed", () =>
      deps.jobs.markFailed(work.jobId, message),
    );
    await attempt(deps, "A failed photoreal job could not be refunded", () => deps.refund(work.eventId));
    return "failed";
  }
}
