/**
 * Wall-clock time in a named time zone, with no library: the platform's Intl data knows every IANA zone and its
 * daylight saving rules. Used for the weekly cut-off, which is set in the factory's own time (decision 0071).
 */

const DAY_MS = 86_400_000;

export interface WallDate {
  readonly year: number;
  /** 1 to 12. */
  readonly month: number;
  readonly day: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

const formatter = (timeZone: string): Intl.DateTimeFormat => {
  let found = formatters.get(timeZone);
  if (!found) {
    found = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, found);
  }
  return found;
};

/** Whether the platform knows the zone. */
export function isTimeZone(timeZone: string): boolean {
  try {
    formatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

/** The wall clock in `timeZone` at an instant, as if it were UTC (milliseconds). */
function wallMs(at: number, timeZone: string): number {
  const parts = Object.fromEntries(formatter(timeZone).formatToParts(new Date(at)).map((p) => [p.type, p.value]));
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
}

/** The zone's offset from UTC at an instant, in milliseconds (whole seconds). */
export function offsetMs(at: number, timeZone: string): number {
  return wallMs(Math.floor(at / 1000) * 1000, timeZone) - Math.floor(at / 1000) * 1000;
}

/** The calendar date in `timeZone` at an instant. */
export function wallDate(at: Date, timeZone: string): WallDate {
  const wall = new Date(wallMs(at.getTime(), timeZone));
  return { year: wall.getUTCFullYear(), month: wall.getUTCMonth() + 1, day: wall.getUTCDate() };
}

/** 0 is Sunday. */
export const weekdayOf = (date: WallDate): number => new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();

export function addDays(date: WallDate, days: number): WallDate {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day) + days * DAY_MS);
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

/** Adds working days (Monday to Friday). A start on a weekend counts from the next Monday. */
export function addWorkingDays(date: WallDate, days: number): WallDate {
  let current = date;
  let left = days;
  while (left > 0) {
    current = addDays(current, 1);
    const weekday = weekdayOf(current);
    if (weekday !== 0 && weekday !== 6) left -= 1;
  }
  return current;
}

export const isoDate = (date: WallDate): string =>
  `${String(date.year).padStart(4, "0")}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;

/**
 * The instant at which the wall clock in `timeZone` shows `minutes` after midnight on `date`. In a spring-forward
 * gap (a time that does not exist) it is the instant just after the gap; in a fall-back overlap, the earlier one.
 */
export function zonedInstant(date: WallDate, minutes: number, timeZone: string): Date {
  const wall = Date.UTC(date.year, date.month - 1, date.day) + minutes * 60_000;
  const before = wall - offsetMs(wall - DAY_MS / 2, timeZone);
  const after = wall - offsetMs(wall + DAY_MS / 2, timeZone);
  // Try the offset in force before the day's change first (the earlier instant in an overlap).
  for (const candidate of [before, after]) {
    if (wallMs(candidate, timeZone) === wall) return new Date(candidate);
  }
  // No instant shows that wall time: it fell in a gap. Use the later offset, which lands just after the gap.
  return new Date(Math.max(before, after));
}
