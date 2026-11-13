import { acceptFulfilmentRequests } from "@/lib/channels/fulfilment";
import { defineRoute } from "@/lib/server/define-route";
import { LIMITS } from "@/lib/server/limits";

const MAX_BODY_BYTES = 64 * 1024;

/**
 * Knitwright as the shop's fulfilment service (plan v6 C4, decision 0155; spec F-L6 "register Knitwright as the
 * fulfilment service"). Shopify calls `<callback>/fulfillment_order_notification` when a merchant asks us to
 * fulfil; the body is checked by its HMAC against the app secret, then every waiting request of that shop is
 * accepted. The order itself arrives through `orders/paid`. 503 with no Shopify app, 401 for a bad signature.
 */
export const POST = defineRoute({
  auth: "public",
  rateLimit: LIMITS.channelsWebhook,
  schema: {},
  handler: async ({ request }) => {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return Response.json({ error: "Too large." }, { status: 413 });
    const answer = await acceptFulfilmentRequests(raw, request.headers.get("x-shopify-hmac-sha256"), request.headers.get("x-shopify-shop-domain"));
    return Response.json({ message: answer.message }, { status: answer.status });
  },
});
