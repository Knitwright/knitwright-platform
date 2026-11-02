import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { throwIfQcFailed } from "../qc/errors";
import { stubInspectionProvider, type BookingRequest, type InspectionProvider } from "./provider";

type Admin = Pick<SupabaseClient, "rpc">;

const COLUMNS = "id, order_id, provider, reference, pieces, requested_on, inspect_on, state, outcome, note, rule_id, at";

const bookingRow = z.object({
  id: z.uuid(),
  order_id: z.uuid(),
  provider: z.string(),
  reference: z.string(),
  pieces: z.number().int(),
  requested_on: z.string(),
  inspect_on: z.string().nullable(),
  state: z.enum(["requested", "booked", "not_available"]),
  outcome: z.string(),
  note: z.string(),
  rule_id: z.string(),
  at: z.string(),
});

export interface InspectionBooking {
  readonly id: string;
  readonly orderId: string;
  readonly provider: string;
  readonly reference: string;
  readonly pieces: number;
  readonly requestedOn: string;
  /** Null: the provider gave no date, and none is invented. */
  readonly inspectOn: string | null;
  readonly state: "requested" | "booked" | "not_available";
  readonly outcome: string;
  readonly note: string;
  readonly ruleId: string;
  readonly at: string;
}

export const toBooking = (data: unknown): InspectionBooking => {
  const r = bookingRow.parse(data);
  return {
    id: r.id,
    orderId: r.order_id,
    provider: r.provider,
    reference: r.reference,
    pieces: r.pieces,
    requestedOn: r.requested_on,
    inspectOn: r.inspect_on,
    state: r.state,
    outcome: r.outcome,
    note: r.note,
    ruleId: r.rule_id,
    at: new Date(r.at).toISOString(),
  };
};

/** Every third-party inspection asked for on an order, newest first. */
export async function listBookings(client: SupabaseClient, orderId: string): Promise<readonly InspectionBooking[]> {
  const { data, error } = await client.from("ops_inspection_bookings").select(COLUMNS).eq("order_id", orderId).order("at", { ascending: false }).limit(50);
  throwIfQcFailed(error);
  return (data ?? []).map(toBooking);
}

export interface BookingToRecord extends BookingRequest {
  readonly orderId: string;
  readonly note: string;
  readonly ruleId: string;
}

/**
 * Asks the provider, then keeps what it said. The provider is the stub, so nothing is called and nothing is
 * paid for; a real adapter would be metered at this one seam.
 */
export async function bookInspection(
  admin: Admin,
  actor: string,
  input: BookingToRecord,
  provider: InspectionProvider = stubInspectionProvider,
): Promise<{ id: string; state: string; reference: string; outcome: string }> {
  const booking = await provider.book(input);
  const { data, error } = await admin.rpc("ops_book_inspection", {
    p_actor: actor,
    p_order_id: input.orderId,
    p_provider: booking.provider,
    p_reference: booking.reference,
    p_state: booking.state,
    p_requested_on: input.requestedOn,
    p_inspect_on: booking.state === "booked" ? booking.inspectOn : null,
    p_outcome: booking.outcome,
    p_note: input.note,
    p_rule_id: input.ruleId,
  });
  throwIfQcFailed(error);
  const id = (Array.isArray(data) ? data[0] : data) as string | undefined;
  if (!id) throw new Error("ops_book_inspection answered with nothing");
  return { id, state: booking.state, reference: booking.reference, outcome: booking.outcome };
}
