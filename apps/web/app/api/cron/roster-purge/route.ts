import { headers } from "next/headers";
import { describePurge, purgeRefusal, runRosterPurge } from "@/lib/clubs/roster-retention/purge";
import { admitCron } from "@/lib/ops/schedule/cut";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/**
 * The roster purge, run by the scheduler once a day (spec 05 security; plan v6 D5, decision 0136).
 *
 * The same door as the weekly cut (decision 0100): no session, the deploy's own `CRON_SECRET` as a bearer token,
 * 503 when the deploy has no secret and 404 for a wrong one. It takes no input. All it can do is remove the
 * rosters of seasons older than two seasons, for clubs that have not opted in to keep them, and a second run
 * removes nothing. Reading the header makes this route dynamic.
 */
export const GET = defineRoute({
  auth: "public",
  rateLimit: LIMITS.read,
  schema: {},
  handler: async () => {
    const admission = admitCron((await headers()).get("authorization"), process.env.CRON_SECRET);
    if (!admission.ok) {
      const refusal = purgeRefusal(admission);
      return Response.json({ error: refusal.error }, { status: refusal.status });
    }
    const run = await runRosterPurge(adminClient());
    return Response.json({ ...run, message: describePurge(run) });
  },
});
