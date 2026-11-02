import { defineRoute } from "@/lib/server/define-route";
import { LIMITS } from "@/lib/server/limits";
import { admitRequest } from "@/lib/store-contract/admit";
import { productsQuery } from "@/lib/store-contract/schemas";
import { serveProducts, storeSecret } from "@/lib/store-contract/server";

/**
 * Published products, as the separate Store reads them (plan v5 O2, decision 0106): the pictures,
 * the sizes, the tier prices in pounds and Australian dollars, the delivery dates, the
 * personalisation rules and the size chart — each carried with its gaps showing.
 *
 * A product is here because the platform holds a hand-off naming it: a drop exported from a
 * collection plan, or a launch pack handed over from a flow canvas. A product nobody handed over is
 * not in the answer at all.
 *
 * No session. The only door is the signed service token, and the answer crosses brands, which no
 * member's session may do. Nothing here is written: every one of these rows is read.
 */
export const GET = defineRoute({
  auth: "public",
  rateLimit: LIMITS.read,
  schema: { query: productsQuery },
  handler: async ({ input, request }) => {
    const admission = admitRequest("store-products", request, storeSecret(), Date.now());
    if (!admission.ok) return Response.json({ error: admission.reason }, { status: admission.status });
    return Response.json(await serveProducts(input.query));
  },
});
