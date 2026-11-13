import { z } from "zod";

/**
 * The payment settings (plan v6 C1, decision 0152): one row of `payment_settings`, labelled, changed only by a
 * platform admin. The seeded numbers are the spec's defaults, not owner answers: the refund reserve is 10% of open
 * pre-order value (F-G4), a run over £2,000 may pay a 40% deposit (F-S7), and no AUD deposit exists until the AUD
 * ladder does. Money is integer minor units.
 */

export const PAY_CURRENCIES = ["GBP", "AUD"] as const;
export type PayCurrency = (typeof PAY_CURRENCIES)[number];

export const UNPRICED_CHOICES = ["invoice", "refuse"] as const;
export type UnpricedChoice = (typeof UNPRICED_CHOICES)[number];

export interface PaymentSettings {
  readonly refundReserveBps: number;
  readonly depositBps: number;
  readonly depositThresholdMinor: Readonly<Record<PayCurrency, number | null>>;
  readonly unpricedOrders: UnpricedChoice;
  readonly isPlaceholder: boolean;
  readonly label: string;
}

export const settingsRow = z.object({
  refund_reserve_bps: z.number().int().min(0).max(10_000),
  deposit_bps: z.number().int().min(1).max(9_999),
  deposit_threshold_gbp_minor: z.coerce.number().int().positive().nullable(),
  deposit_threshold_aud_minor: z.coerce.number().int().positive().nullable(),
  unpriced_orders: z.enum(UNPRICED_CHOICES),
  is_placeholder: z.boolean(),
  label: z.string(),
});

export const SETTINGS_COLUMNS = "refund_reserve_bps, deposit_bps, deposit_threshold_gbp_minor, deposit_threshold_aud_minor, unpriced_orders, is_placeholder, label";

export const settingsOf = (row: z.input<typeof settingsRow>): PaymentSettings => {
  const parsed = settingsRow.parse(row);
  return {
    refundReserveBps: parsed.refund_reserve_bps,
    depositBps: parsed.deposit_bps,
    depositThresholdMinor: { GBP: parsed.deposit_threshold_gbp_minor, AUD: parsed.deposit_threshold_aud_minor },
    unpricedOrders: parsed.unpriced_orders,
    isPlaceholder: parsed.is_placeholder,
    label: parsed.label,
  };
};

export type Schedule = "full" | "deposit";

export type Charge = Readonly<{ schedule: Schedule; amountMinor: number; balanceMinor: number }>;

/** Whether an order of this value may pay a deposit now and the balance before shipping (F-S7: runs only). */
export const depositAllowed = (kind: "sample" | "run", valueMinor: number, currency: PayCurrency, settings: PaymentSettings): boolean => {
  const threshold = settings.depositThresholdMinor[currency];
  return kind === "run" && threshold !== null && valueMinor > threshold;
};

/** The deposit of an order: the share rounded up to a whole minor unit, so the balance is never more than asked. */
export const depositOf = (valueMinor: number, settings: PaymentSettings): number => Math.ceil((valueMinor * settings.depositBps) / 10_000);

/**
 * What the card is charged now. A deposit asked for where it is not allowed is charged in full: the person is never
 * charged less than the rules let them, and never refused for asking.
 */
export function chargeFor(
  kind: "sample" | "run",
  valueMinor: number,
  currency: PayCurrency,
  wanted: Schedule,
  settings: PaymentSettings,
): Charge {
  if (wanted === "deposit" && depositAllowed(kind, valueMinor, currency, settings)) {
    const amountMinor = depositOf(valueMinor, settings);
    return { schedule: "deposit", amountMinor, balanceMinor: valueMinor - amountMinor };
  }
  return { schedule: "full", amountMinor: valueMinor, balanceMinor: 0 };
}
