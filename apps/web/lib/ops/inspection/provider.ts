import { createHash } from "node:crypto";

/**
 * Third-party inspection (spec F-O3; plan v5 O1, decision 0100).
 *
 * The provider is an interface with a deterministic stub, like every other provider in the platform. **No
 * inspection house is called**: no account exists with one, no price is agreed and no turnaround is agreed, so
 * the stub books nothing, answers "not available" and hands back a reference ops can quote when it books by
 * hand. A real adapter would implement the same interface behind its own key and would meter each call, which
 * is why `BookingRequest` carries everything a paid call needs and nothing it does not.
 */

export interface BookingRequest {
  /** The order's own reference, which is what an inspection house is told to look for. */
  readonly orderRef: string;
  readonly pieces: number;
  /** Where the goods are: the factory's city and country, as the factory row holds them. */
  readonly place: string;
  /** The day ops asked, as a date. Never a date the platform chose. */
  readonly requestedOn: string;
}

export type Booking =
  | Readonly<{ state: "booked"; provider: string; reference: string; inspectOn: string | null; outcome: string }>
  | Readonly<{ state: "requested"; provider: string; reference: string; outcome: string }>
  | Readonly<{ state: "not_available"; provider: string; reference: string; outcome: string }>;

export interface InspectionProvider {
  readonly name: string;
  /** What a reader is told about this provider before they press anything. */
  readonly describe: string;
  book(request: BookingRequest): Promise<Booking>;
}

export const NO_INSPECTION_PROVIDER =
  "No inspection house is set up, so nothing was booked. Quote this reference when you book one by hand, and record what it says.";

/** A reference from the order's own reference and the day asked: the same request always gives the same one. */
export const referenceFor = (request: Pick<BookingRequest, "orderRef" | "requestedOn">): string =>
  `KW-TPI-${createHash("sha256").update(`${request.orderRef}|${request.requestedOn}`).digest("hex").slice(0, 10).toUpperCase()}`;

/** The only provider that exists. It reaches no network, books nothing and invents no date. */
export const stubInspectionProvider: InspectionProvider = {
  name: "stub",
  describe: NO_INSPECTION_PROVIDER,
  book: async (request) => ({ state: "not_available", provider: "stub", reference: referenceFor(request), outcome: NO_INSPECTION_PROVIDER }),
};

export type ProviderEnv = Readonly<Record<string, string | undefined>>;

/**
 * The provider in force. There is no adapter to choose yet, so this is always the stub; it reads the
 * environment so that adding one is a change here and nowhere else, as the WhatsApp notifier does.
 */
export function selectInspectionProvider(_env: ProviderEnv = process.env): InspectionProvider {
  return stubInspectionProvider;
}
