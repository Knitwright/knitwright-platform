import { handleWebhook } from "@/lib/payments/server";
import { defineRoute } from "@/lib/server/define-route";
import { LIMITS } from "@/lib/server/limits";

/** Stripe's raw bodies are small; anything larger is not an event. */
const MAX_BODY_BYTES = 256 * 1024;

/**
 * Stripe's webhook (plan v6 C1, decision 0152). No session: the raw body's Stripe-Signature is checked against
 * this deploy's webhook secret before anything is read (`lib/payments/webhook.ts`). 503 with no processor set up,
 * 400 for a bad signature or body, 500 when handling failed (Stripe sends it again), 200 otherwise.
 */
export const POST = defineRoute({
  auth: "public",
  rateLimit: LIMITS.paymentsWebhook,
  schema: {},
  handler: async ({ request }) => {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return Response.json({ error: "Too large." }, { status: 413 });
    const answer = await handleWebhook(raw, request.headers.get("stripe-signature"));
    if (answer === null) return Response.json({ error: "Payments are not set up." }, { status: 503 });
    return Response.json({ received: answer.status === 200, message: answer.message }, { status: answer.status });
  },
});
