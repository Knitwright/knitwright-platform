import { z } from "zod";
import { getEnv } from "@/lib/config/env";
import { patternsOpenTo } from "@/lib/patterns/access";
import { patternJobView } from "@/lib/patterns/job-view";
import { patternRequest } from "@/lib/patterns/request";
import { createPatternJob, expirePatternJob, latestPatternJob } from "@/lib/patterns/service";
import { withCredits, versionOf } from "@/lib/credits-gate/server";
import { getProject } from "@/lib/projects/service";
import { AppError } from "@/lib/server/core/errors";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

const NOT_AVAILABLE = "Patterns are not available yet.";

/**
 * Asks for a sewing pattern of the design at one size, or for the whole size run (the pattern then ends in
 * a block of the pattern library). The request is recorded as a queued
 * job with the design written out in words; whatever drafts patterns picks it up, and the
 * browser polls GET until the DXF is ready. Nothing is charged while patterns are a trial.
 */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.startPattern,
  schema: {
    params: z.object({ projectId: z.uuid() }),
    body: z.object({ size: z.string().trim().min(1).max(12), kind: z.enum(["single", "size-set"]).default("single") }),
  },
  handler: withCredits(
    {
      // Nothing is charged while patterns are not available: the handler refuses the request itself.
      kind: ({ session }) => (patternsOpenTo(getEnv(), session.email) && getEnv().PATTERN_PROVIDER ? "pattern_file" : null),
      version: ({ input, session }) => versionOf(session.brand.id, input.params.projectId),
      where: "POST /api/projects/[projectId]/patterns",
    },
    async ({ input, session }) => {
    const env = getEnv();
    const provider = env.PATTERN_PROVIDER;
    if (!provider || !patternsOpenTo(env, session.email)) throw new AppError("unavailable", NOT_AVAILABLE);
    const client = await sessionClient();
    const brandId = session.brand.id;
    const project = await getProject(client, brandId, input.params.projectId);
    const admin = adminClient();
    const id = await createPatternJob(admin, {
      brandId,
      projectId: input.params.projectId,
      version: project.currentVersion,
      userId: session.userId,
      provider,
      request: patternRequest(project.spec, input.body.size),
      kind: input.body.kind,
    });
    const row = await latestPatternJob(client, brandId, input.params.projectId);
    if (!row || row.id !== id) throw new Error("The new pattern job could not be read back.");
    return patternJobView(row, new Date());
    },
  ),
});

/** The design's newest pattern, which the browser polls while it is drafted. Null when none was asked for. */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.pollJob,
  schema: { params: z.object({ projectId: z.uuid() }) },
  handler: async ({ input, session }) => {
    const available = patternsOpenTo(getEnv(), session.email);
    const row = await latestPatternJob(await sessionClient(), session.brand.id, input.params.projectId);
    if (!row) return { available, job: null };
    const now = new Date();
    await expirePatternJob(adminClient(), row, now);
    return { available, job: patternJobView(row, now) };
  },
});
