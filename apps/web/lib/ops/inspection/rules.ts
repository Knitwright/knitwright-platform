import type { OrderStatus } from "../status";

/**
 * Who may be offered a third-party inspection, and why a booking is blocked when it is (decision 0100).
 * Every sentence names the gate and what would clear it; none of them is a bare refusal.
 */

export interface OfferInput {
  readonly pieces: number;
  /** From the setting, which the spec seeded at 300. */
  readonly overPieces: number;
  readonly status: OrderStatus;
  readonly alreadyBooked: boolean;
}

/** A run is "over 300 pieces" when it is strictly more, as F-O3 words it. */
export const isOverThreshold = (pieces: number, overPieces: number): boolean => pieces > overPieces;

/** Why a third-party inspection cannot be asked for now, as a sentence, or null when it can. */
export function bookingBlocker(input: OfferInput): string | null {
  if (!isOverThreshold(input.pieces, input.overPieces)) {
    return `A third-party inspection is offered for a run over ${input.overPieces} pieces. This order is ${input.pieces}. Raise the figure at /admin/settings to offer it on smaller runs.`;
  }
  if (input.status === "held") return "This order is on hold. Let the hold go before booking an inspection.";
  if (input.status === "submitted") return "This order is not in a batch yet. It is inspected once the factory has it.";
  if (input.alreadyBooked) return "A third-party inspection has already been asked for on this order. Booking again would be a second booking, not a change to the first.";
  return null;
}

export const BOOKING_STATE_LABELS: Readonly<Record<"requested" | "booked" | "not_available", string>> = {
  requested: "Asked for",
  booked: "Booked",
  not_available: "Nothing booked",
};
