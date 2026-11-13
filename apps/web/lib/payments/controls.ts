import { z } from "zod";
import { formatMoney } from "@/lib/factory/pricing";
import { percentOf } from "./amounts";
import type { PayCurrency } from "./settings";

/**
 * F-G4 FINANCIAL CONTROLS (plan v6 C1, decision 0152), as the ops finance page shows them. The figures are worked
 * out by the database (`private.finance_figures`), so this page and the deposit check that refuses an over-large
 * deposit read one sum. Here they are only read and put into words:
 *
 * - "Factory deposits never exceed collected cash minus a refund reserve (default 10% of open pre-order value)."
 * - "Revenue and GMV are reported separately." GMV is the whole value of orders paid for; revenue is what
 *   Knitwright kept: cash collected for orders, credits and plans, less refunds. Neither is added to the other.
 */

const minor = z.coerce.number().int();

export const figuresRow = z.object({
  currency: z.enum(["GBP", "AUD"]),
  gmv_minor: minor,
  collected_minor: minor,
  refunded_minor: minor,
  revenue_minor: minor,
  open_pre_order_minor: minor,
  reserve_minor: minor,
  deposits_minor: minor,
  headroom_minor: minor,
  reserve_bps: z.number().int(),
});

export interface FinanceFigures {
  readonly currency: PayCurrency;
  readonly gmvMinor: number;
  readonly collectedMinor: number;
  readonly refundedMinor: number;
  readonly revenueMinor: number;
  readonly openPreOrderMinor: number;
  readonly reserveMinor: number;
  readonly depositsMinor: number;
  readonly headroomMinor: number;
  readonly reserveBps: number;
}

export const toFigures = (row: unknown): FinanceFigures => {
  const r = figuresRow.parse(row);
  return {
    currency: r.currency,
    gmvMinor: r.gmv_minor,
    collectedMinor: r.collected_minor,
    refundedMinor: r.refunded_minor,
    revenueMinor: r.revenue_minor,
    openPreOrderMinor: r.open_pre_order_minor,
    reserveMinor: r.reserve_minor,
    depositsMinor: r.deposits_minor,
    headroomMinor: r.headroom_minor,
    reserveBps: r.reserve_bps,
  };
};

/** The most the next factory deposit may be: never below nothing. */
export const depositHeadroom = (figures: FinanceFigures): number => Math.max(0, figures.headroomMinor);

export type FigureLine = Readonly<{ id: string; label: string; value: string; note: string }>;

/** The figures of one currency, as labelled lines. GMV and revenue are two lines, never one total. */
export function figureLines(figures: FinanceFigures): readonly FigureLine[] {
  const money = (value: number): string => formatMoney(value, figures.currency);
  return [
    { id: "gmv", label: "GMV", value: money(figures.gmvMinor), note: "The whole value of orders paid for, deposits counted at the order's value." },
    { id: "revenue", label: "Revenue", value: money(figures.revenueMinor), note: "Cash collected for orders, credits and plans, less refunds." },
    { id: "collected", label: "Cash collected", value: money(figures.collectedMinor), note: "Every card charge." },
    { id: "refunded", label: "Refunded", value: money(figures.refundedMinor), note: "Given back, by the platform or in Stripe." },
    { id: "open", label: "Open pre-orders", value: money(figures.openPreOrderMinor), note: "Paid orders not all shipped yet, less refunds." },
    { id: "reserve", label: "Refund reserve", value: money(figures.reserveMinor), note: `${percentOf(figures.reserveBps)} of open pre-orders.` },
    { id: "deposits", label: "Factory deposits", value: money(figures.depositsMinor), note: "Sent to factories ahead of production." },
    { id: "headroom", label: "Next deposit may be up to", value: money(depositHeadroom(figures)), note: "Collected, less refunds, the reserve and deposits already sent." },
  ];
}
