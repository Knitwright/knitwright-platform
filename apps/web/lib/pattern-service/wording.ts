import { quoteWords } from "./quote";
import type { PatternRequest } from "./rows";
import { STATUS_WORDS } from "./transitions";

/** The label on delivered files. It stays until a technician's review is recorded with a name and a date. */
export const NOT_REVIEWED_LABEL = "Pattern from the Sialkot team, not reviewed by a technician";

export const deliveredLabel = (request: Pick<PatternRequest, "reviewedBy" | "reviewedOn">): string =>
  request.reviewedBy && request.reviewedOn ? `Pattern from the Sialkot team, reviewed by ${request.reviewedBy} on ${request.reviewedOn}` : NOT_REVIEWED_LABEL;

/** One line for a brand about where its request stands. */
export function statusLine(request: PatternRequest): string {
  const base = STATUS_WORDS[request.status];
  if (request.status === "declined") return `${base}: ${request.declineReason ?? "no reason was given"}`;
  if (request.status === "delivered") return `${base}. ${deliveredLabel(request)}.`;
  const days = quoteWords({ priceCredits: request.quotedPriceCredits, turnaroundWorkingDays: request.quotedTurnaroundDays }).turnaround;
  return `${base}. Turnaround quoted at the time of the request: ${days}`;
}

/** What the brand is told it is sending, as a list. */
export const WHAT_IS_SENT: readonly string[] = [
  "The design as saved in its current version",
  "The factory file (tech pack) made from it",
  "Nothing else: no player names, no roster, no other designs",
];
