import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import type { Verdict } from "@/lib/moderation/types";
import { CHECKOUT_NOT_SET_UP } from "@/lib/payments/checkout";
import type { PaymentProvider } from "@/lib/payments/provider";
import { AppError } from "@/lib/server/core/errors";
import { shopPath } from "./host";

/**
 * A SHOPPER'S CHECKOUT (spec F-L5 "Stripe Checkout through the Knitwright UK entity as merchant of record"; "Buyers
 * pay at order"; "the policy and a size-confirmation tick are shown before payment").
 *
 * No account and no cart: one product, one size, a quantity, the shopper's email and country. The database prices
 * it from the listing (`open_shop_order`) and opens an ordinary C1 card payment, so Stripe, the signed webhook, the
 * refunds and the F-G4 figures are C1's own; this file only asks C1's processor for the checkout page. A
 * personalised name is screened (F-G1 "text screening of names") before anything is opened.
 *
 * The shopper's page afterwards is reached only with a random token in its address; the database keeps its hash.
 */

export const shopOrderBody = z.object({
  listingId: z.uuid(),
  size: z.string().trim().min(1, "Choose a size.").max(16),
  qty: z.coerce.number().int().min(1).max(20),
  name: z.string().trim().max(20).default(""),
  number: z.union([z.literal(""), z.coerce.number().int().min(0).max(999)]).default(""),
  email: z.email({ error: "Enter your email address." }).max(254),
  country: z.enum(["GB", "AU"], { error: "We deliver to the United Kingdom and Australia." }),
  sizeConfirmed: z.literal(true, { error: "Tick to confirm the size." }),
  returnsAccepted: z.literal(true, { error: "Tick to accept the returns policy." }),
});
export type ShopOrderBody = z.output<typeof shopOrderBody>;

export type OpenedShopOrder = Readonly<{ shopOrderId: string; paymentId: string; amountMinor: number; currency: "GBP" | "AUD"; brandId: string }>;

export type ShopCheckoutDeps = Readonly<{
  provider: PaymentProvider | null;
  siteUrl: string;
  open: (body: ShopOrderBody & Readonly<{ accessHash: string }>) => Promise<OpenedShopOrder>;
  attach: (paymentId: string, provider: PaymentProvider["name"], sessionId: string) => Promise<void>;
  screen: (input: Readonly<{ brandId: string; text: string }>) => Promise<Verdict>;
  newToken?: () => string;
}>;

export type ShopListingRef = Readonly<{ id: string; brandId: string; title: string; slug: string }>;

export const NAME_REFUSED = "That name cannot be printed. Choose another.";

export const accessHashOf = (token: string): string => createHash("sha256").update(token).digest("hex");

export const newAccessToken = (): string => randomBytes(24).toString("hex");

/** The shopper's own order page, with the token that opens it. */
export const orderPagePath = (slug: string, shopOrderId: string, token: string): string => shopPath(slug, `/order/${shopOrderId}?t=${token}`);

/**
 * Where the shopper pays where no Stripe key is set: this storefront's own test checkout. It carries the order and
 * its token, because the token is what lets the shopper (and only the shopper) press "Pay with a test card".
 */
export const payPath = (slug: string, sessionId: string, shopOrderId: string, token: string): string => shopPath(slug, `/pay/${sessionId}?o=${shopOrderId}&t=${token}`);

/** Opens the order and its checkout. Answers where to send the shopper. Throws a refusal in plain words. */
export async function startShopCheckout(deps: ShopCheckoutDeps, listing: ShopListingRef, body: ShopOrderBody): Promise<Readonly<{ url: string; shopOrderId: string }>> {
  if (body.listingId !== listing.id) throw new AppError("invalid_input", "That product is not on sale.");
  if (deps.provider === null) throw new AppError("unavailable", CHECKOUT_NOT_SET_UP);
  if (body.name.length > 0) {
    const verdict = await deps.screen({ brandId: listing.brandId, text: body.name });
    if (verdict.result === "blocked") throw new AppError("invalid_input", NAME_REFUSED);
  }
  const token = (deps.newToken ?? newAccessToken)();
  const opened = await deps.open({ ...body, accessHash: accessHashOf(token) });
  const back = new URL(orderPagePath(listing.slug, opened.shopOrderId, token), deps.siteUrl).toString();
  const session = await deps.provider.createCheckout({
    paymentId: opened.paymentId,
    brandId: opened.brandId,
    mode: "payment",
    currency: opened.currency,
    amountMinor: opened.amountMinor,
    name: listing.title.slice(0, 250) || "Storefront order",
    successUrl: back,
    cancelUrl: `${back}&cancelled=1`,
    customerEmail: body.email,
    metadata: { shop_order_id: opened.shopOrderId },
  });
  await deps.attach(opened.paymentId, deps.provider.name, session.sessionId);
  const url = deps.provider.name === "test" ? payPath(listing.slug, session.sessionId, opened.shopOrderId, token) : session.url;
  return { url, shopOrderId: opened.shopOrderId };
}

/** True when the token opens this order's page: compared as hashes, so the stored value never leaves the server. */
export function tokenOpens(token: string | undefined, accessHash: string): boolean {
  if (typeof token !== "string" || !/^[0-9a-f]{48}$/.test(token)) return false;
  return accessHashOf(token) === accessHash;
}

/** The database's refusals, in the shopper's words. */
export const SHOP_REFUSALS: Readonly<Record<string, string>> = {
  not_on_sale: "That product is not on sale.",
  size_not_sold: "That size is not sold.",
  drop_closed: "This drop is not open. Check the dates on the product page.",
};
