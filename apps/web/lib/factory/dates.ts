import type { ProductionClass } from "./schemas";
import { addDays, addWorkingDays, isoDate, wallDate, weekdayOf, zonedInstant } from "./zoned";

/**
 * Promised dates (spec F-S7, F-O1; decision 0071): the next cut-off, plus the factory's lead time, plus QC, plus
 * freight. Class A closes weekly at a cut-off read in the factory's own time zone (Monday 12:00 in Sialkot, a
 * setting). Class B starts when the order is confirmed. Lead time and QC are working days (Monday to Friday, no
 * public holidays yet); freight is calendar days. Any missing part makes the date "not set": no date is invented.
 */

export interface CutoffSetting {
  /** 0 is Sunday. */
  readonly weekday: number;
  /** Minutes after midnight on the factory's clock. */
  readonly minutes: number;
}

/** The next weekly cut-off at or after `at`. An order at exactly the cut-off is in that batch. */
export function nextCutoff(at: Date, cutoff: CutoffSetting, timeZone: string): Date {
  const today = wallDate(at, timeZone);
  const ahead = (cutoff.weekday - weekdayOf(today) + 7) % 7;
  const candidate = zonedInstant(addDays(today, ahead), cutoff.minutes, timeZone);
  return candidate.getTime() >= at.getTime() ? candidate : zonedInstant(addDays(today, ahead + 7), cutoff.minutes, timeZone);
}

export interface DateInputs {
  readonly orderAt: Date;
  readonly productionClass: ProductionClass;
  readonly timeZone: string;
  readonly cutoff: CutoffSetting;
  readonly leadTimeDays: number | null;
  readonly qcDays: number | null;
  readonly freightDays: number | null;
}

export type PromisedDate =
  | Readonly<{
      status: "set";
      /** When production starts counting: the Class A cut-off, or the Class B confirmation. */
      startsAt: Date;
      readyForQcOn: string;
      shipsOn: string;
      promisedOn: string;
    }>
  | Readonly<{ status: "not-set"; startsAt: Date; missing: readonly string[] }>;

/** When production starts counting for an order made at `orderAt`. */
export const startOf = (input: Pick<DateInputs, "orderAt" | "productionClass" | "timeZone" | "cutoff">): Date =>
  input.productionClass === "A" ? nextCutoff(input.orderAt, input.cutoff, input.timeZone) : input.orderAt;

export function promisedDate(input: DateInputs): PromisedDate {
  const startsAt = startOf(input);
  const missing = [
    input.leadTimeDays === null ? "the factory's lead time" : null,
    input.qcDays === null ? "the days for QC" : null,
    input.freightDays === null ? "the freight days" : null,
  ].filter((m): m is string => m !== null);
  if (missing.length > 0) return { status: "not-set", startsAt, missing };
  const start = wallDate(startsAt, input.timeZone);
  const ready = addWorkingDays(start, input.leadTimeDays!);
  const ships = addWorkingDays(ready, input.qcDays!);
  return {
    status: "set",
    startsAt,
    readyForQcOn: isoDate(ready),
    shipsOn: isoDate(ships),
    promisedOn: isoDate(addDays(ships, input.freightDays!)),
  };
}

/** "Not set: the days for QC and the freight days." */
export function describeMissing(missing: readonly string[]): string {
  if (missing.length === 0) return "";
  const list = missing.length === 1 ? missing[0]! : `${missing.slice(0, -1).join(", ")} and ${missing.at(-1)}`;
  return `Not set: ${list}.`;
}
