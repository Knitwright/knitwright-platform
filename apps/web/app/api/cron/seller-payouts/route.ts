import { headers } from "next/headers";
import { admitCron } from "@/lib/ops/schedule/cut";
import { defineRoute } from "@/lib/server/define-route";
import { LIMITS } from "@/lib/server/limits";
import { describeRun } from "@/lib/store-pages/payout-run";
import { runWeeklyPayouts } from "@/lib/store-pages/server";

/**
 * The weekly seller payout run (plan v6 C5, decision 0156; spec F-L5 "paid out weekly after delivery"), run by the
 * scheduler every Friday (vercel.json). The same door as the weekly cut (decision 0100): no session, the deploy's
 * own `CRON_SECRET` as a bearer token, 503 without one and 404 for a wrong one. It takes no input: it pays every
 * seller what delivered sales owe them, and a second run in the same week pays nothing twice.
 */
export const GET = defineRoute({
  auth: "public",
  rateLimit: LIMITS.read,
  schema: {},
  handler: async () => {
    const admission = admitCron((await headers()).get("authorization"), process.env.CRON_SECRET);
    if (!admission.ok) return Response.json({ error: admission.reason }, { status: admission.status });
    const run = await runWeeklyPayouts();
    return Response.json({ ...run, message: describeRun(run) });
  },
});
