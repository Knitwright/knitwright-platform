import type { CheckoutReply } from "./checkout";
import { refusalsOf } from "./fulfil";

/**
 * What an order door answers the browser (plan v6 C1, decision 0152): go to this checkout, or the orders were sent
 * (an invoice order, whose article has no price on file). Small and plain, so a client component can act on it
 * without importing the server's types.
 */

export type OrderReply =
  | Readonly<{ kind: "checkout"; url: string }>
  | Readonly<{ kind: "sent"; sent: number; refused: string | null }>;

export const replyOf = (reply: CheckoutReply): OrderReply =>
  reply.kind === "checkout"
    ? { kind: "checkout", url: reply.url }
    : { kind: "sent", sent: reply.fulfilment.lines.filter((line) => line.status === "submitted").length, refused: refusalsOf(reply.fulfilment) };

/** The sentence the order forms show once orders were sent without a card. Starts "Sent to production: n orders", as before checkout existed. */
export const sentNote = (reply: Extract<OrderReply, { kind: "sent" }>): string => {
  const base = `Sent to production: ${reply.sent} order${reply.sent === 1 ? "" : "s"}, waiting for the next cut-off. No price is on file yet, so Knitwright invoices it.`;
  return reply.refused === null ? base : `${base} Not sent: ${reply.refused}`;
};

/** Where the browser goes next: the checkout page, or nowhere (the form shows the note). */
export const nextStep = (reply: OrderReply): string | null => (reply.kind === "checkout" ? reply.url : null);

/** The words on the button that sends an order, from whether it has a price to pay now. */
export const sendLabel = (priced: boolean, unpricedLabel: string): string => (priced ? "Checkout" : unpricedLabel);
