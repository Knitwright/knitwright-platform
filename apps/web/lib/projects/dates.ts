/**
 * Dates as people read them. They are always shown in UTC, so the page looks the same
 * on the server and in the browser. Month names are written here, not taken from the
 * machine, because different machines spell some of them differently.
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

const readable = (iso: string): Date | null => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
};

const twoDigits = (value: number): string => String(value).padStart(2, "0");

const dayOf = (date: Date): string =>
  `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;

export const formatDate = (iso: string): string => {
  const date = readable(iso);
  return date ? dayOf(date) : "";
};

export const formatDateTime = (iso: string): string => {
  const date = readable(iso);
  if (!date) return "";
  return `${dayOf(date)}, ${twoDigits(date.getUTCHours())}:${twoDigits(date.getUTCMinutes())} UTC`;
};

/** The day as year, month and day, such as 2026-09-29, in UTC. A spreadsheet reads this form. */
export const isoDay = (iso: string): string => {
  const date = readable(iso);
  return date ? `${date.getUTCFullYear()}-${twoDigits(date.getUTCMonth() + 1)}-${twoDigits(date.getUTCDate())}` : "";
};
