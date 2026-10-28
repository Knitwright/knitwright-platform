/**
 * The royalty sum, kept in step with `designer_accrue_for_order` in the database (migration 20261028020000).
 * Money is a whole number of the smallest unit of the order's currency. No rate is ever invented: while the
 * rate is not set, or the order carries no currency, the units are counted and nothing accrues.
 */

const MAX_RATE_MINOR = 1_000_000;

type Accrual = Readonly<{ rateMinor: number | null; currency: string | null; accruedMinor: number }>;

/** The rate the platform setting holds, or null when it is not set or not a whole number in range. */
export const rateFromSetting = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_RATE_MINOR ? value : null;

export function accrue(input: Readonly<{ units: number; rateMinor: number | null; currency: string | null }>): Accrual {
  if (input.rateMinor === null || input.currency === null) return { rateMinor: null, currency: null, accruedMinor: 0 };
  return { rateMinor: input.rateMinor, currency: input.currency, accruedMinor: input.rateMinor * input.units };
}

export type LedgerLine = Readonly<{ units: number; rateMinor: number | null; currency: string | null; accruedMinor: number }>;

export type LedgerSummary = Readonly<{
  units: number;
  lines: number;
  /** Lines that counted units but accrued nothing, because no rate was set when the order arrived. */
  linesWithoutRate: number;
  accrued: readonly { currency: string; minor: number }[];
}>;

export function summarise(lines: readonly LedgerLine[]): LedgerSummary {
  const byCurrency = new Map<string, number>();
  for (const l of lines) if (l.currency !== null) byCurrency.set(l.currency, (byCurrency.get(l.currency) ?? 0) + l.accruedMinor);
  return {
    units: lines.reduce((sum, l) => sum + l.units, 0),
    lines: lines.length,
    linesWithoutRate: lines.filter((l) => l.rateMinor === null).length,
    accrued: [...byCurrency].sort(([a], [b]) => a.localeCompare(b)).map(([currency, minor]) => ({ currency, minor })),
  };
}

/** "AUD 12.50": the code, then the amount in the currency's own number of decimals. */
export function formatMoney(minor: number, currency: string): string {
  const digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  return `${currency} ${(minor / 10 ** digits).toFixed(digits)}`;
}
