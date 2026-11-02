import { defineRoute } from "@/lib/server/define-route";
import { LIMITS } from "@/lib/server/limits";
import { admitRequest } from "@/lib/store-contract/admit";
import { listQuery } from "@/lib/store-contract/schemas";
import { serveListings, storeSecret } from "@/lib/store-contract/server";

/**
 * Launch packs handed over (plan v5 O2, decision 0106; spec F-L4, decision 0096).
 *
 * "Publish to store" publishes nothing: it writes a listing payload naming which finished pictures
 * and clips a listing may use, what a model made, and the true-colour picture that goes beside each
 * AI scene. This hands each one over unchanged, and writes no second listing payload of its own.
 *
 * No session; the only door is the signed service token.
 */
export const GET = defineRoute({
  auth: "public",
  rateLimit: LIMITS.read,
  schema: { query: listQuery },
  handler: async ({ input, request }) => {
    const admission = admitRequest("store-listings", request, storeSecret(), Date.now());
    if (!admission.ok) return Response.json({ error: admission.reason }, { status: admission.status });
    return Response.json(await serveListings(input.query));
  },
});
