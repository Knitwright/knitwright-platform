import { z } from "zod";
import { SELL_CURRENCIES } from "@/lib/factory/schemas";
import { SPORTS } from "@/lib/teamwear/vocabulary";
import { contentDisposition, type FileName } from "@/lib/techpack/exports/file-names";
import { downloadResponse } from "@/lib/techpack/exports/headers";
import type { Quote } from "./quote";
import { QUOTE_SETTINGS } from "./settings";

/**
 * The address a quote is downloaded from, and the headers it is sent with.
 *
 * The file is built in memory when it is asked for and sent once; nothing is stored, exactly as the
 * tech pack's own exports work, and the headers are that same path's (`exports/headers.ts`), so a
 * quote is served with the same no-store, nosniff, attachment rules as every other Knitwright file.
 *
 * The basket travels in the address rather than in a stored row, because nothing stores a quote
 * (see `number.ts`). The server prices it again from the factory's own tiers, so an address cannot
 * carry a price: only what to price.
 */

export const QUOTE_PATH = "/api/quotes";

/** One line of the basket in an address: `JSY-SS-01:20`. */
const LINE = /^([A-Z]{3}-[A-Z]{2}-[0-9]{2}):([0-9]{1,5})$/;

export interface QuoteLineRef {
  readonly articleCode: string;
  readonly qty: number;
}

const repeated = z
  .union([z.string(), z.array(z.string()).max(8)])
  .optional()
  .transform((value) => (value === undefined ? [] : typeof value === "string" ? [value] : value));

/** A flag in an address: `1` is on and anything else is off. */
const flag = z
  .string()
  .optional()
  .transform((value) => value === "1");

export const quoteQuerySchema = z
  .object({
    sport: z.enum(SPORTS.map((sport) => sport.id) as [string, ...string[]]),
    market: z.enum(SELL_CURRENCIES),
    club: z.string().trim().max(QUOTE_SETTINGS.clubNameMax).optional(),
    line: repeated,
    /** The parts of the kit the catalogue does not cover, by the label the club sees. */
    unpriced: repeated,
    crest: flag,
    names: flag,
    sponsors: z.coerce.number().int().min(0).max(3).optional().catch(0),
  })
  .transform(({ line, club, sponsors, ...rest }) => ({
    ...rest,
    sponsors: sponsors ?? 0,
    clubName: club === undefined || club === "" ? null : club,
    lines: line.flatMap((entry): QuoteLineRef[] => {
      const found = LINE.exec(entry);
      return found === null ? [] : [{ articleCode: found[1]!, qty: Number(found[2]) }];
    }),
  }));

export type QuoteQuery = z.output<typeof quoteQuerySchema>;

export interface QuoteHrefInput {
  readonly sportId: string;
  readonly currency: string;
  readonly clubName: string | null;
  readonly lines: readonly QuoteLineRef[];
  /** The parts the catalogue does not cover, so the document names them instead of dropping them. */
  readonly unpriced?: readonly string[];
  readonly crest?: boolean;
  readonly namesNumbers?: boolean;
  readonly sponsors?: number;
}

/** Where a club presses to get the PDF of a basket. */
export function quoteHref(input: QuoteHrefInput): string {
  const params = new URLSearchParams();
  params.set("sport", input.sportId);
  params.set("market", input.currency);
  if (input.clubName !== null && input.clubName !== "") params.set("club", input.clubName);
  for (const line of input.lines) params.append("line", `${line.articleCode}:${line.qty}`);
  for (const label of input.unpriced ?? []) params.append("unpriced", label);
  if (input.crest === true) params.set("crest", "1");
  if (input.namesNumbers === true) params.set("names", "1");
  if ((input.sponsors ?? 0) > 0) params.set("sponsors", String(input.sponsors));
  return `${QUOTE_PATH}?${params.toString()}`;
}

const NOT_SAFE = /[^A-Za-z0-9_-]/g;

/** The name the file is saved under: `KWQ-20261102-H7KQ4M-quote.pdf`. Safe in any header. */
export const quoteFileName = (quote: Quote): FileName => {
  const plain = `${quote.number.replace(NOT_SAFE, "-")}-quote.pdf`;
  return { plain, original: plain };
};

/** The one response that carries a quote. The bytes are in memory and are sent once. */
export const quoteResponse = (quote: Quote, bytes: Uint8Array<ArrayBuffer>): Response => downloadResponse("pdf", quoteFileName(quote), bytes);

/** The header a quote is sent with, exposed so a test can read it without making a response. */
export const quoteDisposition = (quote: Quote): string => contentDisposition(quoteFileName(quote));
