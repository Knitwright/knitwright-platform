import { formatDate } from "@/lib/projects/dates";

/**
 * When a design was last changed, as a person says it: "2 hours ago", "Yesterday", then the
 * date once it is more than a week old. The moment is passed in, so the result does not
 * depend on a clock.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

const counted = (count: number, unit: string): string => `${count} ${unit}${count === 1 ? "" : "s"} ago`;

export function changedWhen(iso: string, now: Date): string {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return "";
  const elapsed = now.getTime() - at;
  if (elapsed < MINUTE) return "Just now";
  if (elapsed < HOUR) return counted(Math.floor(elapsed / MINUTE), "minute");
  if (elapsed < DAY) return counted(Math.floor(elapsed / HOUR), "hour");
  if (elapsed < 2 * DAY) return "Yesterday";
  if (elapsed < WEEK) return counted(Math.floor(elapsed / DAY), "day");
  return formatDate(iso);
}
