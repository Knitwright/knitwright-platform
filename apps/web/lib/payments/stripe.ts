import { ProviderError, type CheckoutRequest, type CheckoutSession, type PaymentProvider, type RefundRequest } from "./provider";

/**
 * Stripe over its REST API (plan v6 C1, decision 0152), with `fetch` and Stripe's own form encoding, so no SDK is
 * added. Used only when STRIPE_SECRET_KEY is set; the environment check accepts test keys only (`sk_test_`,
 * `rk_test_`), so nothing here can take real money until the owner changes that on purpose. No test calls it: the
 * tests give it a fake `fetch`.
 *
 * Checkout charges ONE line, the amount our payment was opened for, so the amount Stripe reports paid can be held
 * to it exactly (`record_payment_paid` refuses anything else).
 */

export const STRIPE_API = "https://api.stripe.com/v1";
/** The API version every request is made at, so a change on Stripe's side cannot change what is sent. */
export const STRIPE_VERSION = "2025-03-31.basil";

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

type Params = Readonly<Record<string, string | number | boolean | undefined>>;

/** Stripe's form encoding of flat `a[b][c]` keys. Undefined values are left out. */
export const formEncode = (params: Params): string =>
  Object.entries(params)
    .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");

const metadataOf = (prefix: string, metadata: Readonly<Record<string, string>>): Params =>
  Object.fromEntries(Object.entries(metadata).map(([key, value]) => [`${prefix}[${key}]`, value]));

/** The form of a Checkout Session for one payment. */
export function checkoutParams(request: CheckoutRequest, automaticTax: boolean): Params {
  const metadata = { payment_id: request.paymentId, brand_id: request.brandId, ...request.metadata };
  const subscription = request.mode === "subscription";
  return {
    mode: request.mode,
    client_reference_id: request.paymentId,
    success_url: request.successUrl,
    cancel_url: request.cancelUrl,
    customer_email: request.customerEmail,
    "line_items[0][quantity]": 1,
    "line_items[0][price_data][currency]": request.currency.toLowerCase(),
    "line_items[0][price_data][unit_amount]": request.amountMinor,
    "line_items[0][price_data][product_data][name]": request.name,
    "line_items[0][price_data][recurring][interval]": subscription ? (request.interval ?? "month") : undefined,
    "automatic_tax[enabled]": automaticTax ? true : undefined,
    ...metadataOf("metadata", metadata),
    ...(subscription ? metadataOf("subscription_data[metadata]", metadata) : metadataOf("payment_intent_data[metadata]", metadata)),
  };
}

export function stripeProvider(input: Readonly<{ secretKey: string; automaticTax: boolean; fetch?: Fetch }>): PaymentProvider {
  const call = input.fetch ?? ((url, init) => fetch(url, init));
  const post = async (path: string, params: Params, idempotencyKey: string): Promise<Record<string, unknown>> => {
    const response = await call(`${STRIPE_API}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${input.secretKey}`,
        "content-type": "application/x-www-form-urlencoded",
        "idempotency-key": idempotencyKey,
        "stripe-version": STRIPE_VERSION,
      },
      body: formEncode(params),
    });
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      const error = body.error as { message?: string; type?: string } | undefined;
      throw new ProviderError(`Stripe ${path} answered ${response.status}: ${error?.type ?? "error"} ${error?.message ?? ""}`.trim());
    }
    return body;
  };

  return {
    name: "stripe",
    async createCheckout(request): Promise<CheckoutSession> {
      const body = await post("/checkout/sessions", checkoutParams(request, input.automaticTax), `checkout:${request.paymentId}`);
      if (typeof body.id !== "string" || typeof body.url !== "string") throw new ProviderError("Stripe made a checkout with no id or address.");
      return { sessionId: body.id, url: body.url };
    },
    async refund(request: RefundRequest) {
      const body = await post(
        "/refunds",
        { payment_intent: request.providerPaymentId, amount: request.amountMinor, "metadata[payment_id]": request.paymentId },
        request.idempotencyKey,
      );
      if (typeof body.id !== "string") throw new ProviderError("Stripe made a refund with no id.");
      return { refundId: body.id };
    },
  };
}
