/**
 * The period of an AI allowance: a calendar month in UTC. Owner decision 2026-09-30,
 * decision record 0012. A user's and a brand's allowances start again at midnight UTC on the
 * first day of each month. The safety ceiling across everyone is still counted per UTC day.
 * The database keeps the totals (supabase/migrations/20260930050000_monthly_allowances.sql);
 * this module only says which month a moment falls in, and in words when it starts again.
 */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** The first day of the UTC month of `now`, as YYYY-MM-DD, as the database dates it. */
export const allowanceMonth = (now: Date): string =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);

/** Midnight UTC on the first day of the month after `now`. */
export const nextAllowanceReset = (now: Date): Date =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

const resetInWords = (now: Date): string => {
  const reset = nextAllowanceReset(now);
  return `1 ${MONTHS[reset.getUTCMonth()]} (UTC)`;
};

/** What a person is told when their own or their brand's allowance is used up. */
export const allowanceRefusal = (who: "user" | "brand", now: Date): string =>
  `${who === "user" ? "You have" : "Your brand has"} used this month's allowance for this. ` +
  `It starts again on ${resetInWords(now)}.`;
