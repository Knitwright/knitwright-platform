import { formatMoney } from "@/lib/factory/pricing";
import type { AccountRow, PayoutRow, SaleRow } from "./store";

/** The tones of `StatusPill`. */
export type Tone = "ok" | "warn" | "bad" | "info" | "neutral";

/**
 * What the seller's Store pages say (plan v6 C5, decision 0156; spec F-L7): the sales, margin per product, orders
 * and payouts of a brand, worked out from its rows. Every sentence is made here, so the pages hold no rules.
 * Client-safe: no zod, no server imports.
 */

export type Currency = "GBP" | "AUD";

/** The day the weekly run pays (vercel.json `/api/cron/seller-payouts`: Fridays 09:00 UTC). */
export const PAYOUT_WEEKDAY = 5;
export const PAYOUT_HOUR_UTC = 9;

/** The next weekly payout run after `now`. */
export function nextPayoutDate(now: Date): Date {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), PAYOUT_HOUR_UTC));
  const days = (PAYOUT_WEEKDAY - now.getUTCDay() + 7) % 7;
  next.setUTCDate(next.getUTCDate() + days);
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 7);
  return next;
}

export const dayLabel = (date: Date): string => date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });

/** What a sale may pay out at most: its margin less refunds, never below nothing (the database's `sale_payable`). */
export const payableOf = (sale: Pick<SaleRow, "marginMinor" | "refundedMinor">): number => Math.max(sale.marginMinor - sale.refundedMinor, 0);

export type Balance = Readonly<{ currency: Currency; owedMinor: number; heldMinor: number; undelivered: number }>;

/**
 * Per currency: what is owed now (delivered, less what payouts that have not failed paid) and what is held until
 * delivery. `paidBySale` is the sum of each sale's payout lines whose payout did not fail.
 */
export function balancesOf(sales: readonly SaleRow[], paidBySale: ReadonlyMap<string, number>): readonly Balance[] {
  const by = new Map<Currency, { owed: number; held: number; undelivered: number }>();
  for (const sale of sales) {
    const entry = by.get(sale.currency) ?? { owed: 0, held: 0, undelivered: 0 };
    if (sale.deliveredAt === null) {
      entry.held += payableOf(sale);
      entry.undelivered += 1;
    } else {
      entry.owed += payableOf(sale) - (paidBySale.get(sale.id) ?? 0);
    }
    by.set(sale.currency, entry);
  }
  return [...by.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([currency, entry]) => ({ currency, owedMinor: entry.owed, heldMinor: entry.held, undelivered: entry.undelivered }));
}

export type ProductLine = Readonly<{ name: string; units: number; salesMinor: number; marginMinor: number }>;

export type Overview = Readonly<{
  currency: Currency;
  salesMinor: number;
  marginMinor: number;
  orders: number;
  refunds: number;
  top: readonly ProductLine[];
}>;

const sameMonth = (iso: string, now: Date): boolean => {
  const at = new Date(iso);
  return at.getUTCFullYear() === now.getUTCFullYear() && at.getUTCMonth() === now.getUTCMonth();
};

/** The currency most of the brand's sales are in; GBP when there are none. */
export const mainCurrency = (sales: readonly SaleRow[]): Currency =>
  sales.filter((sale) => sale.currency === "AUD").length > sales.length / 2 ? "AUD" : "GBP";

/** This month's sales, margin and orders in the main currency, and the five products with the most margin. */
export function overviewOf(sales: readonly SaleRow[], now: Date): Overview {
  const currency = mainCurrency(sales);
  const mine = sales.filter((sale) => sale.currency === currency);
  const month = mine.filter((sale) => sameMonth(sale.soldAt, now));
  const products = new Map<string, { units: number; sales: number; margin: number }>();
  for (const sale of mine) {
    const entry = products.get(sale.productName) ?? { units: 0, sales: 0, margin: 0 };
    entry.units += sale.quantity;
    entry.sales += sale.retailMinor - sale.refundedMinor;
    entry.margin += payableOf(sale);
    products.set(sale.productName, entry);
  }
  return {
    currency,
    salesMinor: month.reduce((sum, sale) => sum + sale.retailMinor - sale.refundedMinor, 0),
    marginMinor: month.reduce((sum, sale) => sum + payableOf(sale), 0),
    orders: month.length,
    refunds: month.filter((sale) => sale.refundedMinor > 0).length,
    top: [...products.entries()]
      .map(([name, entry]) => ({ name, units: entry.units, salesMinor: entry.sales, marginMinor: entry.margin }))
      .sort((a, b) => b.marginMinor - a.marginMinor || a.name.localeCompare(b.name))
      .slice(0, 5),
  };
}

export type AccountState = "unavailable" | "none" | "onboarding" | "restricted" | "active";

export type AccountView = Readonly<{ state: AccountState; pill: string; tone: Tone; body: string }>;

/** Where the brand's Stripe Connect account stands, in words. */
export function accountView(account: AccountRow | null, available: boolean): AccountView {
  if (account === null) {
    return available
      ? { state: "none", pill: "Not set up", tone: "neutral", body: "Set up payouts with Stripe to be paid your margin weekly, after delivery." }
      : { state: "unavailable", pill: "Coming soon", tone: "neutral", body: "Payouts are not switched on yet. Your margin is kept and paid once they are." };
  }
  if (account.payoutsEnabled) {
    return account.payoutFailure
      ? { state: "active", pill: "Check bank details", tone: "warn", body: account.payoutFailure }
      : { state: "active", pill: "Active", tone: "ok", body: "Stripe Connect · paid weekly after delivery." };
  }
  if (!account.detailsSubmitted) {
    return { state: "onboarding", pill: "Not finished", tone: "warn", body: "Finish giving Stripe your details to be paid." };
  }
  return {
    state: "restricted",
    pill: "Action needed",
    tone: "warn",
    body: `Stripe needs ${account.requirementsDue === 1 ? "one more detail" : `${account.requirementsDue} more details`} before it can pay you.`,
  };
}

export const PAYOUT_STATUS: Readonly<Record<PayoutRow["status"], Readonly<{ label: string; tone: Tone }>>> = {
  pending: { label: "Being prepared", tone: "info" },
  sent: { label: "On its way to your bank", tone: "info" },
  paid: { label: "Paid", tone: "ok" },
  failed: { label: "Failed, paid again next week", tone: "warn" },
};

/** A sale's state, for the sales table. */
export function saleState(sale: SaleRow, paid: number): Readonly<{ label: string; tone: Tone }> {
  if (sale.refundedMinor >= sale.retailMinor && sale.retailMinor > 0) return { label: "Refunded", tone: "neutral" };
  if (sale.deliveredAt === null) return { label: "Waiting for delivery", tone: "info" };
  const due = payableOf(sale) - paid;
  if (due > 0) return { label: "Owed", tone: "warn" };
  if (due < 0) return { label: "Refund taken off next payout", tone: "warn" };
  return { label: "Paid out", tone: "ok" };
}

export const money = (minor: number, currency: Currency): string => formatMoney(minor, currency);
