import { AppError } from "@/lib/server/core/errors";
import { ARTWORK_LIMITS } from "./limits";

/**
 * At most a few conversions run for one brand at once, so one brand cannot take a whole server's
 * memory. The count is kept in the server process; each server holds its own.
 */
const running = new Map<string, number>();

export const BUSY = "Your earlier files are still being prepared. Wait a moment, then try again.";

export async function withConversionSlot<T>(brandId: string, work: () => Promise<T>, limit: number = ARTWORK_LIMITS.maxConversionsPerBrand): Promise<T> {
  const active = running.get(brandId) ?? 0;
  if (active >= limit) throw new AppError("rate_limited", BUSY);
  running.set(brandId, active + 1);
  try {
    return await work();
  } finally {
    const left = (running.get(brandId) ?? 1) - 1;
    if (left <= 0) running.delete(brandId);
    else running.set(brandId, left);
  }
}
