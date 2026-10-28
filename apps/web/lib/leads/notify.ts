import type { LogEvent } from "@/lib/server/core/guard";

/**
 * Telling the Knitwright team about a new quote request. No mail sender exists yet (Resend is
 * owner action A4), so the notice is one info line in the server log, and the request waits on
 * the leads page. When a sender exists, add a notifier that emails the owner and use it in
 * lib/leads/actions.ts. See lib/leads/OWNER-QUESTIONS.md.
 *
 * The line names ids and numbers only: no email address or message reaches the log.
 */

interface QuoteNotice {
  readonly quoteId: string;
  readonly brandId: string;
  readonly projectId: string;
  readonly version: number;
  readonly quantity: number;
  readonly neededBy: string;
}

type QuoteNotifier = (notice: QuoteNotice) => Promise<void>;

export const loggingQuoteNotifier =
  (log: (event: LogEvent) => void): QuoteNotifier =>
  async (notice) => {
    log({
      level: "info",
      where: "quote-request",
      message:
        `New quote request ${notice.quoteId}: brand ${notice.brandId}, design ${notice.projectId} ` +
        `version ${notice.version}, ${notice.quantity} pieces by ${notice.neededBy}. See /admin/leads.`,
    });
  };
