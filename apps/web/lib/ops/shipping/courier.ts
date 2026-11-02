import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { throwIfQcFailed } from "../qc/errors";

/**
 * Couriers as data, and the seam a real courier API would land on (spec F-O4, "courier booking and tracking
 * stored"; owner question 24; plan v5 O1, decision 0100).
 *
 * A courier is a row: its name, its terms as agreed, the days it takes when a figure is agreed, and the
 * address of its tracking page as a template. Nothing is a literal in code, and nothing is invented: a courier
 * with no tracking page on file gets no link, and a courier with no transit days agreed shows no date.
 *
 * `CourierProvider` is the interface. The only implementation is the manual option, which is what the platform
 * does today: ops types in the courier and the number it was given, and nothing is sent to anybody. A real
 * courier adapter would implement the same interface behind its own key, would be metered on every booking,
 * and would be the one that answers `provider: "courier"`. None exists: no account is open with any courier.
 */

export interface Courier {
  readonly code: string;
  readonly name: string;
  readonly provider: string;
  /** `https://…/{tracking}`. Null: this courier has no tracking page on file, so no link is shown. */
  readonly trackingUrlTemplate: string | null;
  /** The terms agreed, in the courier's own words. Empty: nothing is agreed. */
  readonly terms: string;
  /** Calendar days, when a figure is agreed. Null: not agreed, so no delivery date anywhere. */
  readonly transitDays: number | null;
  readonly active: boolean;
  readonly ruleId: string;
  readonly label: string;
}

export const COURIER_COLUMNS = "code, name, provider, tracking_url_template, terms, transit_days, active, rule_id, label";

const courierRow = z.object({
  code: z.string(),
  name: z.string(),
  provider: z.string(),
  tracking_url_template: z.string().nullable(),
  terms: z.string(),
  transit_days: z.number().int().nullable(),
  active: z.boolean(),
  rule_id: z.string(),
  label: z.string(),
});

export const toCourier = (data: unknown): Courier => {
  const r = courierRow.parse(data);
  return {
    code: r.code,
    name: r.name,
    provider: r.provider,
    trackingUrlTemplate: r.tracking_url_template,
    terms: r.terms,
    transitDays: r.transit_days,
    active: r.active,
    ruleId: r.rule_id,
    label: r.label,
  };
};

/** The couriers ops may record a parcel against. Read with the server's key: no browser role reaches the table. */
export async function listCouriers(admin: Pick<SupabaseClient, "from">): Promise<readonly Courier[]> {
  const { data, error } = await admin.from("ops_couriers").select(COURIER_COLUMNS).eq("active", true).order("name").limit(100);
  throwIfQcFailed(error);
  return (data ?? []).map(toCourier);
}

/** The courier's own tracking page for a number, or null when no address is on file. None is invented. */
export function trackingUrlFor(courier: Pick<Courier, "trackingUrlTemplate"> | null, trackingNumber: string): string | null {
  const template = courier?.trackingUrlTemplate ?? null;
  if (template === null) return null;
  return template.replace("{tracking}", encodeURIComponent(trackingNumber.trim()));
}

export interface CourierBookingRequest {
  readonly courier: Courier | null;
  /** What ops typed: the courier's name as they know it, and the number the courier gave. */
  readonly courierName: string;
  readonly trackingNumber: string;
}

export interface CourierBooking {
  /** "manual" while nothing is booked with a courier. "courier" is for an adapter that books a label. */
  readonly provider: "manual" | "courier";
  readonly courier: string;
  readonly courierCode: string | null;
  readonly trackingNumber: string;
  readonly trackingUrl: string | null;
  /** What happened, in plain words, for the record and the screen. */
  readonly outcome: string;
}

export interface CourierProvider {
  readonly name: string;
  readonly describe: string;
  book(request: CourierBookingRequest): Promise<CourierBooking>;
}

export const MANUAL_COURIER_NOTE = "Entered by hand. Nothing is sent to a courier, and no label is booked.";

/** The manual option: exactly what ops typed, plus the courier's own tracking page when one is on file. */
export const manualCourier: CourierProvider = {
  name: "manual",
  describe: MANUAL_COURIER_NOTE,
  book: async ({ courier, courierName, trackingNumber }) => ({
    provider: "manual",
    courier: (courierName.trim() || courier?.name || "").trim(),
    courierCode: courier?.code ?? null,
    trackingNumber: trackingNumber.trim(),
    trackingUrl: trackingUrlFor(courier, trackingNumber),
    outcome: MANUAL_COURIER_NOTE,
  }),
};

export type CourierEnv = Readonly<Record<string, string | undefined>>;

/**
 * The provider in force. There is no courier adapter yet (owner question 24 is unanswered and no account is
 * open), so this is always the manual option; it reads the environment so that adding an adapter is a change
 * here and nowhere else, as the WhatsApp notifier does.
 */
export function selectCourierProvider(_env: CourierEnv = process.env): CourierProvider {
  return manualCourier;
}
