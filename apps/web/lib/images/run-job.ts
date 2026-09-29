import type { View } from "@/lib/flat/model";
import { ProviderError, type GeneratedImage, type ImageProvider, type ImageRequest } from "@/lib/providers";
import type { LogEvent } from "@/lib/server/core/guard";

/**
 * The work of one photoreal job, run after the response with `after()`. Plan step 14,
 * tasks 3 and 4. Both views are made, then both are stored, then the job is marked done.
 * On any failure the job is marked failed and the reservation is given back. It never
 * throws: nothing is waiting for it.
 */

/** Within the 60 seconds a request may run (decision record 0002), with room to store. */
export const JOB_TIME_LIMIT_MS = 50_000;

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
  readonly refund: (eventId: string) => Promise<boolean>;
  readonly log: (event: LogEvent) => void;
  readonly timeoutMs?: number;
}

export interface JobWork {
  readonly jobId: string;
  readonly eventId: string;
  readonly requests: Readonly<Record<"front" | "back", ImageRequest>>;
}

const WHERE = "photoreal job";

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
  const files = { front: await deps.saveImage("front", front), back: await deps.saveImage("back", back) };
  await deps.jobs.markSucceeded(work.jobId, files);
}

export async function runImageJob(deps: RunJobDeps, work: JobWork): Promise<"succeeded" | "failed"> {
  try {
    await make(deps, work);
    return "succeeded";
  } catch (error) {
    deps.log({ level: "error", message: `Photoreal images failed (${deps.provider.name})`, where: WHERE, error });
    const message = error instanceof ProviderError && error.refused ? UNAVAILABLE_MESSAGE : FAILED_MESSAGE;
    await attempt(deps, "A failed photoreal job could not be marked failed", () =>
      deps.jobs.markFailed(work.jobId, message),
    );
    await attempt(deps, "A failed photoreal job could not be refunded", () => deps.refund(work.eventId));
    return "failed";
  }
}
