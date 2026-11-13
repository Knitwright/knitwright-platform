import { formatMoney, type Ladder } from "@/lib/factory/pricing";
import { runPrice } from "@/lib/payments/pricing";
import { marginMinorOf, marginPercent } from "./rules";

/**
 * The price line under the Open a team store form (decision 0153): what a buyer will pay a piece and what the club
 * keeps, from the same ladder and the same rounding the server and the database use. Pure, for the form.
 */
export type PricePreview = Readonly<{ ok: true; text: string; pieceMinor: number }> | Readonly<{ ok: false; text: string }>;

export function previewPrice(ladder: Ladder, minPieces: number, marginBps: number): PricePreview {
  if (!Number.isInteger(minPieces) || minPieces < 1) return { ok: false, text: "Type a minimum of 1 piece or more." };
  const price = runPrice(ladder, minPieces, "GBP");
  if (price.status !== "priced") return { ok: false, text: `${price.reason} A team store needs a price, because its buyers pay by card.` };
  const margin = marginMinorOf(price.unitMinor, marginBps);
  const piece = price.unitMinor + margin;
  const club = marginBps === 0 ? "No club margin." : `The club keeps ${formatMoney(margin, "GBP")} a piece (${marginPercent(marginBps)}), paid after the store closes.`;
  return { ok: true, pieceMinor: piece, text: `Buyers pay ${formatMoney(piece, "GBP")} a piece: ${formatMoney(price.unitMinor, "GBP")} at the ${minPieces}-piece tier, plus the club's margin. ${club}` };
}

/** Today and two weeks on, as the form's first dates. */
export function defaultDates(now: Date): Readonly<{ opensOn: string; closesOn: string }> {
  const day = (date: Date) => date.toISOString().slice(0, 10);
  return { opensOn: day(now), closesOn: day(new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)) };
}
