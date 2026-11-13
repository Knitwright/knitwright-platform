import { headers } from "next/headers";
import { runTrackingSync } from "@/lib/channels/server";
import { admitCron } from "@/lib/ops/schedule/cut";
import { defineRoute } from "@/lib/server/define-route";
import { LIMITS } from "@/lib/server/limits";

/**
 * Tracking back to Shopify, run by the scheduler every 15 minutes (plan v6 C4, decision 0155; spec F-L6 "sync
 * tracking"). The same door as the weekly cut (decision 0100): no session, the deploy's own CRON_SECRET as a bearer
 * token, 503 without it, 404 for a wrong one. It takes no input; all it can do is send the first parcel's tracking
 * of each shipped Shopify order line to its shop, once. 503 too when no Shopify app is set up.
 */
export const GET = defineRoute({
  auth: "public",
  rateLimit: LIMITS.read,
  schema: {},
  handler: async () => {
    const admission = admitCron((await headers()).get("authorization"), process.env.CRON_SECRET);
    if (!admission.ok) return Response.json({ error: admission.reason }, { status: admission.status });
    const result = await runTrackingSync();
    if (result === null) return Response.json({ error: "The Shopify app is not set up on this deploy." }, { status: 503 });
    return Response.json(result);
  },
});
