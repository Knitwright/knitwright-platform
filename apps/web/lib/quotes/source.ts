import type { QuoteOutcome, QuoteRequest, QuoteSource } from "@/lib/teamwear/ideas";
import { quoteHref } from "./download";
import { quoteNumber } from "./number";

/**
 * The real `QuoteSource` behind the configurator's Quote button (spec F-T1 sticky footer, F-T5).
 *
 * Z5 declared the interface and shipped `unavailableQuotes`, which says plainly that the quote is
 * not switched on (Lesson 9). This is the other side: it hands back the number the document will
 * carry and the address the document is at. Nothing is built here — the document is built when the
 * address is asked for, which is what keeps it inside the specification's five seconds and what
 * means a club that never presses the button costs nothing.
 *
 * The sport and the club's name are not on Z5's `QuoteRequest`, so they are closed over: the screen
 * knows both, and a quote needs both. The orchestrator wires this in place of `unavailableQuotes`
 * with the sport the configurator is showing.
 */

export interface QuoteContext {
  readonly sportId: string;
  /** The club's own name for the document's heading, or null when the screen has none. */
  readonly clubName: string | null;
  readonly now?: () => Date;
}

/** Said where the basket holds nothing the factory prices, so there is nothing to quote. */
export const NOTHING_TO_QUOTE =
  "There is nothing to quote yet: no part of this kit has a base article the factory prices. Add a part the catalogue covers, or ask Knitwright.";

export function quoteSource(context: QuoteContext): QuoteSource {
  const now = context.now ?? (() => new Date());
  return {
    quoteFor(request: QuoteRequest): Promise<QuoteOutcome> {
      if (request.lines.length === 0) return Promise.resolve({ status: "unavailable", reason: NOTHING_TO_QUOTE });
      const lines = request.lines.map((line) => ({ articleCode: line.articleCode, qty: line.qty }));
      const clubName = context.clubName ?? request.projectId;
      return Promise.resolve({
        status: "quoted",
        quoteNumber: quoteNumber(now(), { clubName, sportId: context.sportId, currency: request.currency, lines }),
        downloadPath: quoteHref({ sportId: context.sportId, currency: request.currency, clubName: context.clubName, lines }),
      });
    },
  };
}
