import { buildQuotePdf } from "@/lib/quotes/document";
import { quoteQuerySchema, quoteResponse } from "@/lib/quotes/download";
import { QuoteRefused } from "@/lib/quotes/quote";
import { buildQuoteFor } from "@/lib/quotes/server";
import { AppError } from "@/lib/server/core/errors";
import { defineRoute } from "@/lib/server/define-route";
import { LIMITS } from "@/lib/server/limits";

/** No handler may rely on more than 60 seconds (decision 0002). A quote takes well under one. */
export const maxDuration = 60;

/**
 * One quote as a PDF (spec F-T5). It is built in memory when it is asked for and sent once;
 * nothing is stored, as the tech pack's own exports work.
 *
 * The basket travels in the address and the prices are read again from the factory's own tiers, so
 * an address cannot carry a price. The parts of the kit the catalogue does not cover are named in
 * the address too, so the document can say the total leaves them out rather than pretending the
 * kit is whole. It is rate limited like an export, because it builds a file.
 */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.export,
  schema: { query: quoteQuerySchema },
  handler: async ({ input, session }) => {
    const { sport, market, clubName, lines, unpriced, crest, sponsors, names } = input.query;
    try {
      const quote = await buildQuoteFor(
        { brandName: session.brand.name, now: () => new Date() },
        {
          sportId: sport,
          currency: market,
          clubName,
          lines,
          unpricedLabels: unpriced,
          inclusions: { crest, sponsors, namesNumbers: names },
        },
      );
      return quoteResponse(quote, await buildQuotePdf(quote));
    } catch (error) {
      if (error instanceof QuoteRefused) throw new AppError("invalid_input", error.message);
      throw error;
    }
  },
});
