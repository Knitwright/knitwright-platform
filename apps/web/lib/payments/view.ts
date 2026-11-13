import { formatMoney } from "@/lib/factory/pricing";
import type { LineRow, PaymentRow } from "./store";

/**
 * What the checkout pages say about a payment (plan v6 C1, decision 0152): the return page after Stripe, the test
 * checkout and the ops list. Every sentence is worked out here from the rows, so the pages hold no wording rules.
 */

export type Tone = "ok" | "info" | "warn";

export interface PaymentHeadline {
  readonly title: string;
  readonly body: string;
  readonly tone: Tone;
  /** True while the processor has not said yet: the page offers "Check again". */
  readonly waiting: boolean;
}

const money = (payment: PaymentRow, minor: number): string => formatMoney(minor, payment.currency);

/** What is charged now, and the balance where a deposit was paid. */
export function amountLine(payment: PaymentRow): string {
  if (payment.method === "invoice") return "No card payment: no price is on file yet, so Knitwright invoices this order.";
  if (payment.schedule === "deposit") {
    return `${money(payment, payment.amountMinor)} deposit now. The balance of ${money(payment, payment.balanceDueMinor)} is invoiced by Knitwright before shipping.`;
  }
  return `${money(payment, payment.amountMinor)}${payment.purpose === "plan" ? (payment.planInterval === "year" ? " a year" : " a month") : ""}`;
}

const DONE: Readonly<Record<PaymentRow["purpose"], string>> = {
  order: "Your order is on its way to production. It waits for the next weekly cut-off.",
  credits: "The credits are in your balance.",
  plan: "Your plan is active.",
};

/** The person left the checkout: whether or not Stripe has closed it yet, nothing was charged. */
const CANCELLED: PaymentHeadline = { title: "Checkout cancelled", body: "Nothing was charged. Nothing has gone to production.", tone: "info", waiting: false };

/** The headline of the return page, from the payment's state and whether the person left the checkout. */
export function headlineOf(payment: PaymentRow, cancelled: boolean, lines: readonly LineRow[] = []): PaymentHeadline {
  const refused = lines.filter((line) => line.status === "refused");
  switch (payment.status) {
    case "fulfilled":
    case "invoice":
      return refused.length === 0
        ? { title: payment.method === "invoice" ? "Sent to production" : "Paid", body: DONE[payment.purpose], tone: "ok", waiting: false }
        : { title: "Paid, with a refund", body: `${refused.length} of the orders could not go to production, and their share was refunded: ${refused.map((line) => line.message).join(" ")}`, tone: "warn", waiting: false };
    case "paid":
      return { title: "Paid", body: "Your payment went through. We are sending it on now.", tone: "ok", waiting: true };
    case "refunded":
      return { title: "Refunded", body: `${money(payment, payment.refundedMinor)} was given back to the card.`, tone: "info", waiting: false };
    case "expired":
      return cancelled ? CANCELLED : { title: "Checkout closed", body: "Nothing was charged. Start again from the order whenever you are ready.", tone: "info", waiting: false };
    case "open":
      return cancelled ? CANCELLED : { title: "Waiting for the payment", body: "Stripe has not said the payment went through yet. This usually takes a few seconds.", tone: "info", waiting: true };
  }
}

const LINE_STATE: Readonly<Record<LineRow["status"], string>> = {
  waiting: "Waiting for payment",
  submitted: "Sent to production",
  refused: "Not sent",
};

/** One order of a payment, for the return page's list. */
export const lineSummary = (line: LineRow): Readonly<{ label: string; state: string }> => ({
  label: `${line.kind === "sample" ? "Sample" : "Run"} · ${line.pieces} piece${line.pieces === 1 ? "" : "s"} · ${Object.keys(line.sizes).join(", ")}`,
  state: line.status === "refused" && line.message ? `${LINE_STATE.refused}: ${line.message}` : LINE_STATE[line.status],
});

/** Where the person goes next from a payment. */
export const nextPlaceOf = (payment: PaymentRow): Readonly<{ href: string; label: string }> =>
  payment.purpose === "order" ? { href: "/orders", label: "Your orders" } : payment.purpose === "credits" ? { href: "/credits", label: "Your credits" } : { href: "/settings", label: "Plan & billing" };
