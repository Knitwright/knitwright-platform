import type { OutputKind } from "./kinds";

/**
 * The one place credit numbers are set. EVERY NUMBER HERE IS A PLACEHOLDER, NOT A PRICE.
 *
 * The owner has not set what an output costs or how many credits a brand gets each month.
 * These values only let the ledger run and be tested. The migration seeds `credit_prices` with
 * the same prices (`settings-seed.test.ts` fails if the two disagree), and `syncCreditPrices`
 * writes this file's prices to the database when the owner changes them. Change them here only.
 * Questions for the owner: lib/credits/OWNER-QUESTIONS.md.
 */
export const CREDIT_SETTINGS = {
  isPlaceholder: true,
  /** Credits one output costs. */
  prices: {
    marketing_media: 1,
    techpack_pdf: 1,
    pattern_file: 1,
  } satisfies Record<OutputKind, number>,
  /** Credits every brand is given at the start of each UTC month. */
  monthlyAllowance: 10,
} as const;

export const PLACEHOLDER_NOTICE =
  "These are placeholder numbers, not a price. The owner has not set what credits cost or how many each brand gets.";

/** The shape of the credit numbers, so a stored override can take the place of CREDIT_SETTINGS (lib/settings). */
export interface CreditSettingsShape {
  readonly isPlaceholder: boolean;
  readonly prices: Record<OutputKind, number>;
  readonly monthlyAllowance: number;
}
