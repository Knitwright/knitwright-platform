import { valueOf } from "@/lib/settings/resolve";
import type { StoredSettings } from "@/lib/settings/types";
import { PATTERN_PRICE_KEY, PATTERN_TURNAROUND_KEY } from "./keys";


/** What a request is quoted at, copied from the settings the moment it is made. Null is "not set": nothing is promised or charged. */
export type Quote = Readonly<{ priceCredits: number | null; turnaroundWorkingDays: number | null }>;

const numberOrNull = (value: unknown): number | null => (typeof value === "number" ? value : null);

export const quoteFrom = (stored: StoredSettings): Quote => ({
  priceCredits: numberOrNull(valueOf(stored, PATTERN_PRICE_KEY)),
  turnaroundWorkingDays: numberOrNull(valueOf(stored, PATTERN_TURNAROUND_KEY)),
});

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}.`;

export function quoteWords(quote: Quote): Readonly<{ price: string; turnaround: string }> {
  const { priceCredits: price, turnaroundWorkingDays: days } = quote;
  return {
    price: price === null ? "Knitwright will confirm the price." : price === 0 ? "Free." : plural(price, "credit", "credits"),
    turnaround: days === null ? "Knitwright will confirm the turnaround." : plural(days, "working day", "working days"),
  };
}
