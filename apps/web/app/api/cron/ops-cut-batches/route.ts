import { headers } from "next/headers";
import { admitCron, describeRun } from "@/lib/ops/schedule/cut";
import { runScheduledCut } from "@/lib/ops/schedule/service";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/**
 * The weekly cut, run by the scheduler (spec F-O1; plan v5 O1, decision 0100).
 *
 * A Vercel cron route rather than a database cron, for the reason decision 0100 gives: the cut-off is a
 * setting, the schedule is only a tick, and the deploy that owns the settings is the one that should run it.
 * `vercel.json` fires it every hour; `ops_cut_scheduled` works out whether a cut-off has passed and is
 * idempotent on it, so a schedule that fires twice cuts one set of batches.
 *
 * There is no session: the scheduler sends the deploy's own `CRON_SECRET` as a bearer token, and that is the
 * only door. Without the secret set the job is switched off (503) rather than open to anyone, and a wrong
 * secret answers 404 like any other route a stranger finds. Reading the header makes this route dynamic.
 */
export const GET = defineRoute({
  auth: "public",
  rateLimit: LIMITS.read,
  schema: {},
  handler: async () => {
    const admission = admitCron((await headers()).get("authorization"), process.env.CRON_SECRET);
    if (!admission.ok) return Response.json({ error: admission.reason }, { status: admission.status });
    const run = await runScheduledCut(adminClient());
    return Response.json({ ...run, message: describeRun(run) });
  },
});
