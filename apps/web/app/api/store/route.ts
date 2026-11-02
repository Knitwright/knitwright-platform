import { defineRoute } from "@/lib/server/define-route";
import { LIMITS } from "@/lib/server/limits";
import { admitRequest } from "@/lib/store-contract/admit";
import { serveManifest, storeSecret } from "@/lib/store-contract/server";

/**
 * The Store contract's manifest (plan v5 O2, decision 0106): the endpoints, how a call is signed,
 * how a value the platform does not hold is shaped, and the sentence that says nothing here takes
 * money. It is what a reader that has only the address can start from.
 *
 * There is no session. These endpoints answer the separate Store, not a browser: the only door is a
 * token signed with `STORE_SERVICE_TOKEN`, compared in constant time. Without the secret set the
 * route answers 503 and reads nothing; a token that does not verify answers 404 with one sentence
 * saying how to sign. Reading the request's own header is what makes this route dynamic.
 */
export const GET = defineRoute({
  auth: "public",
  rateLimit: LIMITS.read,
  schema: {},
  handler: async ({ request }) => {
    const admission = admitRequest("store-manifest", request, storeSecret(), Date.now());
    if (!admission.ok) return Response.json({ error: admission.reason }, { status: admission.status });
    return Response.json(await serveManifest());
  },
});
