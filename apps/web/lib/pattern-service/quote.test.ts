import { describe, expect, it } from "vitest";
import type { StoredSettings } from "@/lib/settings/types";
import { PATTERN_PRICE_KEY, PATTERN_TURNAROUND_KEY } from "./keys";
import { quoteFrom, quoteWords } from "./quote";

const row = (value: unknown) => ({ value, setBy: "admin", setAt: "2026-10-26T10:00:00.000Z" });

describe("the quote", () => {
  it("is not set when nothing is stored, and invents nothing", () => {
    const quote = quoteFrom({});
    expect(quote).toEqual({ priceCredits: null, turnaroundWorkingDays: null });
    expect(quoteWords(quote)).toEqual({ price: "Knitwright will confirm the price.", turnaround: "Knitwright will confirm the turnaround." });
  });

  it("copies the stored price and turnaround", () => {
    const stored: StoredSettings = { [PATTERN_PRICE_KEY]: row(12), [PATTERN_TURNAROUND_KEY]: row(5) };
    const quote = quoteFrom(stored);
    expect(quote).toEqual({ priceCredits: 12, turnaroundWorkingDays: 5 });
    expect(quoteWords(quote)).toEqual({ price: "12 credits.", turnaround: "5 working days." });
  });

  it("says 1 credit and 1 working day in the singular", () => {
    expect(quoteWords({ priceCredits: 1, turnaroundWorkingDays: 1 })).toEqual({ price: "1 credit.", turnaround: "1 working day." });
  });

  it("treats a price of 0 as free, which is a price", () => {
    expect(quoteWords({ priceCredits: 0, turnaroundWorkingDays: null }).price).toBe("Free.");
  });

  it("ignores a stored value that fails its schema", () => {
    expect(quoteFrom({ [PATTERN_PRICE_KEY]: row(-3), [PATTERN_TURNAROUND_KEY]: row("soon") })).toEqual({ priceCredits: null, turnaroundWorkingDays: null });
  });
});
