import type { OpsSettings } from "./settings";

const DAY_MS = 86_400_000;

/**
 * The cut-off an order made at `at` falls under: the next weekly cut-off at or after `at`, in UTC.
 * An order made exactly at the cut-off is in that batch. The SQL function `private.next_cutoff`
 * does the same sum, and tests/integration/ops-batches.test.ts holds the two to each other.
 */
export function nextCutoff(at: Date, settings: Pick<OpsSettings, "cutoffWeekday" | "cutoffMinutes">): Date {
  const midnight = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
  const ahead = (settings.cutoffWeekday - at.getUTCDay() + 7) % 7;
  const candidate = midnight + settings.cutoffMinutes * 60_000 + ahead * DAY_MS;
  return new Date(candidate < at.getTime() ? candidate + 7 * DAY_MS : candidate);
}

/** The date the factory is promised to deliver: the cut-off date plus the lead time. Null while no lead time is set. */
export function promisedOn(cutoff: Date, leadTimeDays: number | null): string | null {
  if (leadTimeDays === null) return null;
  return new Date(cutoff.getTime() + leadTimeDays * DAY_MS).toISOString().slice(0, 10);
}
