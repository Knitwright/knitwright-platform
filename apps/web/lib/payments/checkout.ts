import { AppError } from "@/lib/server/core/errors";
import type { Fulfilment } from "./fulfil";
import { refusalsOf } from "./fulfil";
import type { LinePrice } from "./pricing";
import type { CheckoutRequest, PaymentProvider } from "./provider";
import { chargeFor, type PayCurrency, type Schedule } from "./settings";
import type { NewLine, OpenPayment, PaymentsStore } from "./store";

/**
 * CHECKOUT (plan v6 C1, decision 0152; spec F-T7 "Stripe Checkout in GBP or AUD, through the UK entity as merchant
 * of record"; F-S7 "price and lead time are shown before payment").
 *
 * Every app door that sends work calls this AFTER its own refusals — sizes, golden sample, the D1 validation gate,
 * the content screen — so nobody is asked to pay for an order that would be refused. It opens a payment holding
 * each order exactly as it will be sent, and then:
 *
 * - every line priced: a Stripe Checkout for what is due now (the whole value, or a deposit on a run over the
 *   threshold); the order goes to production when the webhook says it is paid;
 * - a line with no price on file: by default (setting `unpriced_orders`, owner question C1-1) the payment is an
 *   invoice and the orders go to production now, as before this workstream, for Knitwright to invoice; with the
 *   setting on `refuse`, the order is refused with the ladder's reason.
 */

export type OrderLineIntent = Omit<NewLine, "valueMinor" | "priceLabel"> & Readonly<{ price: LinePrice }>;

export type CheckoutReply =
  | Readonly<{ kind: "checkout"; paymentId: string; url: string }>
  | Readonly<{ kind: "sent"; paymentId: string; fulfilment: Fulfilment }>;

export type CheckoutDeps = Readonly<{
  store: PaymentsStore;
  provider: PaymentProvider | null;
  siteUrl: string;
  fulfil: (paymentId: string) => Promise<Fulfilment>;
}>;

export type Buyer = Readonly<{ brandId: string; userId: string; email?: string }>;

export const CHECKOUT_NOT_SET_UP = "Card checkout is not set up on this deploy yet, so this order cannot be paid. Nothing was charged.";

export const returnUrls = (siteUrl: string, paymentId: string): Readonly<{ successUrl: string; cancelUrl: string }> => ({
  successUrl: new URL(`/checkout/return?payment=${paymentId}`, siteUrl).toString(),
  cancelUrl: new URL(`/checkout/return?payment=${paymentId}&cancelled=1`, siteUrl).toString(),
});

const lineOf = (intent: OrderLineIntent): NewLine => {
  const { price, ...line } = intent;
  return { ...line, valueMinor: price.status === "priced" ? price.valueMinor : null, priceLabel: price.status === "priced" ? price.label : null };
};

/** Opens a processor checkout for a payment already opened, and returns where to send the person. */
export async function openSession(deps: CheckoutDeps, request: Omit<CheckoutRequest, "successUrl" | "cancelUrl">): Promise<string> {
  if (deps.provider === null) throw new AppError("unavailable", CHECKOUT_NOT_SET_UP);
  const existing = await deps.store.payment(request.paymentId);
  if (existing && (existing.status !== "open" || existing.sessionId !== null)) {
    throw new AppError("conflict", "This order already has a checkout. Start it again from the order page.");
  }
  const session = await deps.provider.createCheckout({ ...request, ...returnUrls(deps.siteUrl, request.paymentId) });
  await deps.store.attachSession(request.paymentId, deps.provider.name, session.sessionId);
  return session.url;
}

async function sendInvoice(deps: CheckoutDeps, open: OpenPayment): Promise<CheckoutReply> {
  const paymentId = await deps.store.open(open);
  const fulfilment = await deps.fulfil(paymentId);
  const refused = refusalsOf(fulfilment);
  if (refused !== null && fulfilment.lines.every((line) => line.status === "refused")) throw new AppError("conflict", refused);
  return { kind: "sent", paymentId, fulfilment };
}

/** Starts paying for one or more orders. Throws a refusal in plain words when it cannot. */
export async function startOrderCheckout(
  deps: CheckoutDeps,
  buyer: Buyer,
  input: Readonly<{ lines: readonly OrderLineIntent[]; currency: PayCurrency; schedule: Schedule; description: string }>,
): Promise<CheckoutReply> {
  if (input.lines.length === 0) throw new AppError("invalid_input", "Choose something to order first.");
  const settings = await deps.store.settings();
  const unpriced = input.lines.flatMap((line) => (line.price.status === "unpriced" ? [line.price.reason] : []));
  const base = { brandId: buyer.brandId, userId: buyer.userId, purpose: "order" as const, currency: input.currency, description: input.description.slice(0, 300), credits: null, planId: null, planInterval: null, lines: input.lines.map(lineOf) };

  if (unpriced.length > 0) {
    if (settings.unpricedOrders === "refuse") throw new AppError("conflict", `${[...new Set(unpriced)].join(" ")} Knitwright has to set a price before this can be ordered.`);
    return sendInvoice(deps, { ...base, method: "invoice", orderValueMinor: null, amountMinor: 0, schedule: "full" });
  }

  if (deps.provider === null) throw new AppError("unavailable", CHECKOUT_NOT_SET_UP);
  const valueMinor = base.lines.reduce((sum, line) => sum + (line.valueMinor ?? 0), 0);
  const kind = input.lines.some((line) => line.kind === "run") ? "run" : "sample";
  const charge = chargeFor(kind, valueMinor, input.currency, input.schedule, settings);
  const paymentId = await deps.store.open({ ...base, method: "card", orderValueMinor: valueMinor, amountMinor: charge.amountMinor, schedule: charge.schedule });
  const name = charge.schedule === "deposit" ? `Deposit: ${base.description}` : base.description;
  const url = await openSession(deps, { paymentId, brandId: buyer.brandId, mode: "payment", currency: input.currency, amountMinor: charge.amountMinor, name: name.slice(0, 250), customerEmail: buyer.email });
  return { kind: "checkout", paymentId, url };
}
