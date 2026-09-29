import { z } from "zod";
import { isStale, jobView } from "@/lib/images/job-view";
import { expireJob, readJob } from "@/lib/images/service";
import { AppError } from "@/lib/server/core/errors";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, productionDeps, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/**
 * The state of one photoreal job, which the browser polls. A job whose server stopped is
 * given up here, and its cost given back.
 */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.pollJob,
  schema: { params: z.object({ projectId: z.uuid(), jobId: z.uuid() }) },
  handler: async ({ input, session }) => {
    const client = await sessionClient();
    const row = await readJob(client, session.brand.id, input.params.projectId, input.params.jobId);
    if (!row) throw new AppError("not_found", "Those images could not be found.");
    const now = new Date();
    if (isStale(row, now)) await expireJob(adminClient(), row, productionDeps.usage.refund);
    return jobView(row, now);
  },
});
