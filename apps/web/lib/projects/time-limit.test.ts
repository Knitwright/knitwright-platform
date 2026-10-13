import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TimeLimitError, withTimeLimit } from "./time-limit";

describe("withTimeLimit", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("gives the answer when it comes in time", async () => {
    const answer = withTimeLimit(Promise.resolve(7), 1000);
    await expect(answer).resolves.toBe(7);
  });

  it("passes a failure on as it is", async () => {
    const answer = withTimeLimit(Promise.reject(new Error("no")), 1000);
    await expect(answer).rejects.toThrow("no");
  });

  it("gives up when the answer takes too long, so a save never shows Saving for ever", async () => {
    const answer = withTimeLimit(new Promise<number>(() => undefined), 1000);
    const caught = answer.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(1000);
    const error = await caught;
    expect(error).toBeInstanceOf(TimeLimitError);
    expect((error as Error).message).toBe("No answer within 1000 ms.");
  });
});
