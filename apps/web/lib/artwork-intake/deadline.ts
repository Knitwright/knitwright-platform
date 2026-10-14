import { AppError } from "@/lib/server/core/errors";
import { REFUSALS } from "./messages";

/** Stops waiting for work that takes too long and says so in plain words. The work itself cannot be cancelled. */
export const withDeadline = async <T>(work: Promise<T>, ms: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new AppError("invalid_input", REFUSALS.tooSlow)), ms);
  });
  try {
    return await Promise.race([work, late]);
  } finally {
    clearTimeout(timer);
  }
};
