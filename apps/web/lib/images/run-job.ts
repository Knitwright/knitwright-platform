import type { View } from "@/lib/flat/model";
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

export interface JobStore {
  markRunning(jobId: string): Promise<void>;
  markSucceeded(jobId: string, files: Readonly<{ front: string; back: string }>): Promise<void>;
  markFailed(jobId: string, message: string): Promise<void>;
}

export interface RunJobDeps {
  readonly provider: ImageProvider;
  readonly jobs: JobStore;
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
