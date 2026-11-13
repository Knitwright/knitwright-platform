import { CHECKOUT_NOT_SET_UP } from "@/lib/payments/checkout";
import type { PaymentProvider } from "@/lib/payments/provider";
import type { PaymentsStore } from "@/lib/payments/store";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import type { PurchaseLine } from "./model";
import { checkPurchase, isTakingOrders, storeAddress } from "./rules";
import type { TeamStoreStore } from "./store";

/**
 * BUYING FROM A TEAM STORE without an account (plan v6 C2, decision 0153; spec F-T6 "Players and parents buy from a
 * short link or QR code without an account", F-T7 "Team stores: each buyer pays at checkout, and the order is
 * created at close").
 *
 * The order of things: the store must be taking orders; every line is checked against the store's sizes, the
 * name zone and the number range; every shirt name is screened (F-G1, profanity); then the database opens the
 * purchase and its C1 payment and works out the amount from the store's own prices; then the processor makes the
 * checkout. The browser never sends a price. The buyer's name and email are the only details kept (decision 0136).
 *
 * The checkout comes back to this store's own public pages, not to the member pages C1's checkout returns to:
 * the buyer has no account. With the test checkout (CI, a local run) the buyer is sent to this store's own test
 * page, which signs the event and hands it to C1's webhook (`lib/team-stores/actions.ts`).
 */

export type BuyDeps = Readonly<{
  stores: TeamStoreStore;
  payments: PaymentsStore;
  provider: PaymentProvider | null;
  siteUrl: string;
  /** X8's text screen for a shirt name. Throws, or answers "blocked" with the words to show. */
  screenName: (input: Readonly<{ brandId: string; text: string }>) => Promise<Readonly<{ blocked: boolean; message: string | null }>>;
  now: () => Date;
}>;

export type BuyInput = Readonly<{ code: string; requestKey: string; buyerName: string; buyerEmail: string; lines: readonly PurchaseLine[] }>;

export const STORE_NOT_OPEN = "This store is not taking orders. Ask your club when the next one opens.";
export const ALREADY_STARTED = "This order already has a checkout open. Finish it in the other tab, or start again from the store page.";

/** Where the buyer comes back to after paying, and after leaving the checkout. */
export const buyerReturnUrls = (siteUrl: string, code: string, paymentId: string) => ({
  successUrl: `${storeAddress(siteUrl, code)}/done?payment=${paymentId}`,
  cancelUrl: `${storeAddress(siteUrl, code)}/done?payment=${paymentId}&cancelled=1`,
});

/** The test checkout's page for a team store buyer: public, like the store. */
export const testPayPath = (code: string, sessionId: string): string => `/t/${code}/pay/${sessionId}`;

const fieldErrors = (problems: ReturnType<typeof checkPurchase>): Record<string, string[]> => {
  const fields: Record<string, string[]> = {};
  for (const problem of problems) (fields.lines ??= []).push(`Piece ${problem.index + 1}: ${problem.message}`);
  return fields;
};

async function screenNames(deps: BuyDeps, brandId: string, lines: readonly PurchaseLine[]): Promise<void> {
  for (const [index, line] of lines.entries()) {
    if (line.printName === "") continue;
    const verdict = await deps.screenName({ brandId, text: line.printName });
    if (verdict.blocked) {
      throw new AppError("invalid_input", MESSAGES.invalid_input, { lines: [`Piece ${index + 1}: ${verdict.message ?? "That name cannot be printed. Choose another."}`] });
    }
  }
}

/** Opens the buyer's checkout and answers where to send them. Throws a refusal in plain words. */
export async function startStoreCheckout(deps: BuyDeps, input: BuyInput): Promise<Readonly<{ url: string; paymentId: string }>> {
  const store = await deps.stores.storeByCode(input.code);
  if (store === null) throw new AppError("not_found", "That store does not exist.");
  if (!isTakingOrders(store, deps.now())) throw new AppError("conflict", STORE_NOT_OPEN);
  const problems = checkPurchase(store, input.lines);
  if (problems.length > 0) throw new AppError("invalid_input", MESSAGES.invalid_input, fieldErrors(problems));
  if (deps.provider === null) throw new AppError("unavailable", CHECKOUT_NOT_SET_UP);
  await screenNames(deps, store.brandId, input.lines);

  const purchase = await deps.stores.openPurchase(input);
  const payment = await deps.payments.payment(purchase.paymentId);
  if (!purchase.created && (payment === null || payment.status !== "open" || payment.sessionId !== null)) throw new AppError("conflict", ALREADY_STARTED);

  const session = await deps.provider.createCheckout({
    paymentId: purchase.paymentId,
    brandId: purchase.brandId,
    mode: "payment",
    currency: purchase.currency,
    amountMinor: purchase.amountMinor,
    name: purchase.description.slice(0, 250),
    customerEmail: input.buyerEmail,
    metadata: { team_store_id: purchase.storeId },
    ...buyerReturnUrls(deps.siteUrl, input.code, purchase.paymentId),
  });
  await deps.payments.attachSession(purchase.paymentId, deps.provider.name, session.sessionId);
  const url = deps.provider.name === "test" ? new URL(testPayPath(input.code, session.sessionId), deps.siteUrl).toString() : session.url;
  return { url, paymentId: purchase.paymentId };
}
