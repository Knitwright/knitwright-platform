import { formatDate } from "@/lib/projects/dates";

/**
 * A request for a quote on one version of a design: its limits, statuses and wording. Kept apart
 * from the zod schemas (lib/leads/quote.ts) so the quote forms do not ship zod to the browser.
 * The database checks the same rules in request_quote.
 */

export const QUANTITY_MAX = 1_000_000;
export const SIZES_NOTE_MAX = 500;
export const MESSAGE_MAX = 1000;

export const QUOTE_STATUSES = [
  { id: "new", label: "Waiting for a reply" },
  { id: "quoted", label: "Quote sent" },
  { id: "closed", label: "Closed" },
] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number]["id"];

export const quoteStatusLabel = (status: QuoteStatus): string =>
  QUOTE_STATUSES.find((entry) => entry.id === status)?.label ?? status;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar date written YYYY-MM-DD. */
export const isCalendarDate = (text: string): boolean => {
  if (!DATE.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
};

/** The earliest needed-by date a form may offer: tomorrow, in UTC, as the database counts days. */
export const firstAllowedDate = (now: Date): string =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString().slice(0, 10);

/** One line about a request, such as "120 pieces, needed by 1 Dec 2026. Waiting for a reply." */
export const describeQuote = (quote: Readonly<{ quantity: number; neededBy: string; status: QuoteStatus }>): string =>
  `${quote.quantity} ${quote.quantity === 1 ? "piece" : "pieces"}, needed by ${formatDate(quote.neededBy)}. ${quoteStatusLabel(quote.status)}.`;
