import { describeMissing } from "@/lib/factory/dates";
import { addDays, addWorkingDays, isoDate, type WallDate } from "@/lib/factory/zoned";

/**
 * The delivery date on an order (spec F-S7, F-O1; 10 §10 "never promise what the factory hasn't
 * confirmed"). Ops promises the date the factory is ready (cut-off plus lead time). Delivery adds
 * the days for QC (working days) and the freight days (calendar days). Any part not on file makes
 * the answer "not set" with the parts named; no date is guessed.
 */

export type Delivery =
  | Readonly<{ status: "set"; on: string }>
  | Readonly<{ status: "not-set"; missing: readonly string[]; text: string }>;

export interface DeliveryInput {
  /** The factory's ready date ops promised, or null while the lead time is unset. */
  readonly readyOn: string | null;
  readonly qcDays: number | null;
  readonly freightDays: number | null;
}

const wall = (iso: string): WallDate => ({ year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)), day: Number(iso.slice(8, 10)) });

export function deliveryFor(input: DeliveryInput): Delivery {
  const { readyOn, qcDays, freightDays } = input;
  if (readyOn === null || qcDays === null || freightDays === null) {
    const missing = [
      readyOn === null ? "the factory's lead time" : null,
      qcDays === null ? "the days for QC" : null,
      freightDays === null ? "the freight days" : null,
    ].filter((m): m is string => m !== null);
    return { status: "not-set", missing, text: `No delivery date yet. ${describeMissing(missing)}` };
  }
  return { status: "set", on: isoDate(addDays(addWorkingDays(wall(readyOn), qcDays), freightDays)) };
}
