import { headers } from "next/headers";
import { purgeRefusal } from "@/lib/clubs/roster-retention/purge";
import { admitCron } from "@/lib/ops/schedule/cut";
import { defineRoute } from "@/lib/server/define-route";
import { LIMITS } from "@/lib/server/limits";
import { sweepStores } from "@/lib/team-stores/close";
import { closeDeps, teamStores } from "@/lib/team-stores/server";

/**
 * The team store run (plan v6 C2, decision 0153), every 15 minutes: every store whose close time has come becomes
 * one order or refunds its buyers; a purchase paid after its store closed is refunded; and buyers' names, emails and
 * shirt names are erased 180 days after their store closed (decision 0136's rule for people without accounts).
 *
 * The same door as the roster purge (decision 0100): no session, the deploy's own `CRON_SECRET` as a bearer token,
 * 503 when the deploy has no secret and 404 for a wrong one. It takes no input, and a second run does nothing new.
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
    const now = new Date();
    const closed = await sweepStores(closeDeps(), now);
    const erased = await teamStores().purgeBuyers(now);
    return Response.json({ stores: closed, erased });
  },
});
