import { handleShopifyWebhook } from "@/lib/channels/server";
import { defineRoute } from "@/lib/server/define-route";
import { LIMITS } from "@/lib/server/limits";

/** Shopify's bodies for these topics are small; anything larger is not one of them. */
const MAX_BODY_BYTES = 512 * 1024;

/**
 * Shopify's webhooks, every topic at one address (plan v6 C4, decision 0155): orders/paid, app/uninstalled and the
 * mandatory privacy topics (customers/data_request, customers/redact, shop/redact). No session: the raw body's
 * X-Shopify-Hmac-Sha256 is checked against the app secret before anything is read (`lib/channels/shopify/
 * webhooks.ts`). 503 with no Shopify app set up, 401 for a bad signature, 400 for a bad body, 500 when taking an
 * order failed (Shopify sends it again), 200 otherwise.
 */
export const POST = defineRoute({
  auth: "public",
  rateLimit: LIMITS.channelsWebhook,
  schema: {},
  handler: async ({ request }) => {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return Response.json({ error: "Too large." }, { status: 413 });
    const answer = await handleShopifyWebhook(raw, {
      hmac: request.headers.get("x-shopify-hmac-sha256"),
      topic: request.headers.get("x-shopify-topic"),
      shop: request.headers.get("x-shopify-shop-domain"),
    });
    if (answer === null) return Response.json({ error: "Shopify is not set up." }, { status: 503 });
    return Response.json({ message: answer.message }, { status: answer.status });
  },
});
