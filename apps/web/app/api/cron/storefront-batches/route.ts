import { headers } from "next/headers";
import { admitCron } from "@/lib/ops/schedule/cut";
import { describeRun } from "@/lib/storefront/batching";
import { runStorefrontBatches } from "@/lib/storefront/run";
import { defineRoute } from "@/lib/server/define-route";
import { LIMITS } from "@/lib/server/limits";

/**
 * The storefront batches, run by the scheduler (spec F-L5 "made-to-order sales join the weekly batch", "at close the
 * drop becomes one batch"; plan v6 C3, decision 0154). Every hour: drops whose window has passed are closed, each of
 * their listings' paid orders become one batch, and the made-to-order sales before the latest Monday 12:00 PKT
 * cut-off become one batch per listing; then every open batch is sent through the brand run door. Idempotent: a
 * batch is cut once per listing and cut-off (or drop), and a settled batch never moves.
 *
 * The same door as the weekly cut: the deploy's own `CRON_SECRET` as a bearer token, 503 without it, 404 for a wrong
 * one.
 */
export const GET = defineRoute({
  auth: "public",
  rateLimit: LIMITS.read,
  schema: {},
  handler: async () => {
    const admission = admitCron((await headers()).get("authorization"), process.env.CRON_SECRET);
    if (!admission.ok) return Response.json({ error: admission.reason }, { status: admission.status });
    const run = await runStorefrontBatches(new Date());
    return Response.json({ ...run, message: describeRun(run) });
  },
});
