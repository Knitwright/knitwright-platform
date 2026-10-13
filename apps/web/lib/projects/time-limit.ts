/** How long the editor waits for a save before it treats the reply as lost and checks the design. */
export const SAVE_TIME_LIMIT_MS = 30_000;

/** How long the editor waits for the page to show a version it was told about. */
export const PAGE_TIME_LIMIT_MS = 15_000;

/** Thrown when an answer took longer than the time allowed. */
export class TimeLimitError extends Error {
  constructor(ms: number) {
    super(`No answer within ${ms} ms.`);
    this.name = "TimeLimitError";
  }
}

/**
 * The answer of `promise`, or a TimeLimitError when it takes longer than `ms`. The work
 * itself is not stopped: a late answer is simply not waited for.
 */
export const withTimeLimit = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeLimitError(ms)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
