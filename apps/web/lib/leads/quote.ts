import { z } from "zod";
import { formatDate } from "@/lib/projects/dates";
import { MAX_VERSION } from "@/lib/projects/schemas";
import { daysUntil } from "./score";

/**
 * A request for a quote on one version of a design. The Knitwright team replies by email; there
 * are no prices in the platform yet. The database checks the same rules in request_quote.
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

const STATUS_IDS = QUOTE_STATUSES.map((status) => status.id) as [QuoteStatus, ...QuoteStatus[]];

export const quoteStatusSchema = z.enum(STATUS_IDS, "Choose a status.");

export const quoteStatusLabel = (status: QuoteStatus): string =>
  QUOTE_STATUSES.find((entry) => entry.id === status)?.label ?? status;

const WHOLE = "Enter a whole number from 1.";
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar date written YYYY-MM-DD. */
export const isCalendarDate = (text: string): boolean => {
  if (!DATE.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
};

const note = (max: number) =>
  z.string().trim().max(max, `Keep it under ${max} characters.`).default("");

/** `now` is asked each time a form is read, so "after today" means the day it is sent. */
export const quoteRequestSchemaAt = (now: () => Date) =>
  z.object({
    projectId: z.uuid("That is not a design."),
    version: z.coerce.number().int().min(1).max(MAX_VERSION),
    quantity: z
      .string(WHOLE)
      .trim()
      .regex(/^\d+$/, WHOLE)
      .transform(Number)
      .pipe(z.number().int().min(1, WHOLE).max(QUANTITY_MAX, `Ask for at most ${QUANTITY_MAX.toLocaleString("en-AU")}.`)),
    neededBy: z
      .string("Choose the date you need it by.")
      .trim()
      .refine(isCalendarDate, "Choose the date you need it by.")
      .refine((date) => !isCalendarDate(date) || daysUntil(date, now()) > 0, "Choose a date after today."),
    sizesNote: note(SIZES_NOTE_MAX),
    message: note(MESSAGE_MAX),
  });

export const quoteRequestSchema = quoteRequestSchemaAt(() => new Date());

export type QuoteRequestInput = z.output<typeof quoteRequestSchema>;

/** The earliest needed-by date a form may offer: tomorrow, in UTC, as the database counts days. */
export const firstAllowedDate = (now: Date): string =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString().slice(0, 10);

/** One line about a request, such as "120 pieces, needed by 1 Dec 2026. Waiting for a reply." */
export const describeQuote = (quote: Readonly<{ quantity: number; neededBy: string; status: QuoteStatus }>): string =>
  `${quote.quantity} ${quote.quantity === 1 ? "piece" : "pieces"}, needed by ${formatDate(quote.neededBy)}. ${quoteStatusLabel(quote.status)}.`;
