import { defineRoute } from "@/lib/server/define-route";
import { LIMITS } from "@/lib/server/limits";
import { admitRequest } from "@/lib/store-contract/admit";
import { listQuery } from "@/lib/store-contract/schemas";
import { serveTeamStores, storeSecret } from "@/lib/store-contract/server";

/**
 * A team store's configuration, from a club design (plan v5 O2, decision 0105; spec F-T1).
 *
 * A configuration and nothing else: the design, the colours, the crest, the sponsors, the fonts for
 * names and numbers, the seasons and the numbers the sport allows. There is no link here and no
 * shop front — a team store is the separate Store's own product.
 *
 * No session; the only door is the signed service token.
 */
export const GET = defineRoute({
  auth: "public",
  rateLimit: LIMITS.read,
  schema: { query: listQuery },
  handler: async ({ input, request }) => {
    const admission = admitRequest("store-team-stores", request, storeSecret(), Date.now());
    if (!admission.ok) return Response.json({ error: admission.reason }, { status: admission.status });
    return Response.json(await serveTeamStores(input.query));
  },
});
