import { defineRoute } from "@/lib/server/define-route";
import { LIMITS } from "@/lib/server/limits";
import { admitRequest } from "@/lib/store-contract/admit";
import { listQuery } from "@/lib/store-contract/schemas";
import { serveDrops, storeSecret } from "@/lib/store-contract/server";

/**
 * Drops from collection plans (plan v5 O2, decision 0105; spec F-S10, decision 0085).
 *
 * "Create drop" already wrote the payload and `collection_drops` already keeps it, append-only and
 * numbered per collection. This hands each one over unchanged. A row this deploy cannot read is
 * refused by id rather than carried half-read.
 *
 * No session; the only door is the signed service token.
 */
export const GET = defineRoute({
  auth: "public",
  rateLimit: LIMITS.read,
  schema: { query: listQuery },
  handler: async ({ input, request }) => {
    const admission = admitRequest("store-drops", request, storeSecret(), Date.now());
    if (!admission.ok) return Response.json({ error: admission.reason }, { status: admission.status });
    return Response.json(await serveDrops(input.query));
  },
});
