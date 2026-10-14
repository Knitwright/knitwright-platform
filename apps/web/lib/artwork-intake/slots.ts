import { AppError } from "@/lib/server/core/errors";
import { REFUSALS } from "./messages";
import { INTAKE_LIMITS } from "./settings";

/**
 * At most a few files are read at once for one brand, so one account cannot take all the processor time. The count
 * is kept in this server process, so the limit holds per instance; the rate limit holds everywhere.
 */
const running = new Map<string, number>();

export const withSlot = async <T>(brandId: string, work: () => Promise<T>, limit: number = INTAKE_LIMITS.maxInFlightPerBrand): Promise<T> => {
  const now = running.get(brandId) ?? 0;
  if (now >= limit) throw new AppError("rate_limited", REFUSALS.busy);
  running.set(brandId, now + 1);
  try {
    return await work();
  } finally {
    const left = (running.get(brandId) ?? 1) - 1;
    if (left <= 0) running.delete(brandId);
    else running.set(brandId, left);
  }
};

/** For tests. */
export const slotsInUse = (brandId: string): number => running.get(brandId) ?? 0;
