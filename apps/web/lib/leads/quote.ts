import { z } from "zod";
import { MAX_VERSION } from "@/lib/projects/schemas";
import {
  MESSAGE_MAX,
  QUANTITY_MAX,
  QUOTE_STATUSES,
  SIZES_NOTE_MAX,
  describeQuote,
  firstAllowedDate,
  isCalendarDate,
  quoteStatusLabel,
  type QuoteStatus,
} from "./quote-terms";
import { daysUntil } from "./score";

export { QUANTITY_MAX, describeQuote, firstAllowedDate, isCalendarDate, quoteStatusLabel, type QuoteStatus };

/** The checks on a quote request and on a change of its status, made on the server. */

const STATUS_IDS = QUOTE_STATUSES.map((status) => status.id) as [QuoteStatus, ...QuoteStatus[]];

export const quoteStatusSchema = z.enum(STATUS_IDS, "Choose a status.");

const WHOLE = "Enter a whole number from 1.";

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
