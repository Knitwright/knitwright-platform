import { describeMissing, type PromisedDate } from "@/lib/factory/dates";

/**
 * The delivery date the make pages show (F-S7 acceptance: "the delivery date shown equals cut-off + factory lead time
 * + QC + freight from current factory profile data").
 *
 * It shows exactly what `promisedDate` (decision 0071) answers and nothing else. The factory rows on file today carry
 * no QC days and no freight days, so the honest answer is that there is no date yet and these are the parts missing.
 * Nothing here promises a date, and no part of one is filled in with a guess.
 */

export interface DeliveryInput {
  readonly date: PromisedDate;
  /** True while the cut-off and QC days are still Knitwright's placeholders rather than a factory's terms. */
  readonly placeholder: boolean;
}

export interface DeliveryLine {
  readonly status: "set" | "not-set";
  /** The date in ISO form, or null when there is none. Never a guess. */
  readonly promisedOn: string | null;
  readonly text: string;
  /** What else the reader has to know about the figure. Empty when there is nothing. */
  readonly note: string;
}

export const PLACEHOLDER_NOTE = "The cut-off and the days for QC are Knitwright placeholders, not a factory's terms.";

export function deliveryLine(input: DeliveryInput): DeliveryLine {
  const note = input.placeholder ? PLACEHOLDER_NOTE : "";
  if (input.date.status !== "set") {
    return { status: "not-set", promisedOn: null, text: `No delivery date yet. ${describeMissing(input.date.missing)}`.trim(), note };
  }
  return {
    status: "set",
    promisedOn: input.date.promisedOn,
    text: `Delivery ${input.date.promisedOn}, from the factory data on file: the next cut-off, the factory's lead time, the days for QC and the freight days.`,
    note,
  };
}

/** The date a "Ready by" filter can work on, or null when the factory data gives none. */
export const readyBy = (line: DeliveryLine): string | null => line.promisedOn;
