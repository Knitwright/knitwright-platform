import { z } from "zod";
import { printFileBuilder } from "@/lib/releases/builder";
import { reorderBody } from "@/lib/releases/schemas";
import { checkReorder } from "@/lib/releases/use-cases";
import { defineRoute } from "@/lib/server/define-route";
import { sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

export const maxDuration = 60;

/**
 * Builds the release's files again and compares each with its frozen hash. The answer says whether
 * they are the same and, when not, why. Nothing is sent: a person chooses what happens next.
 */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.printFiles,
  schema: { params: z.object({ projectId: z.uuid(), releaseId: z.uuid() }), body: reorderBody },
  handler: async ({ input, session }) =>
    checkReorder(await sessionClient(), session.brand.id, input.params.projectId, input.params.releaseId, input.body, printFileBuilder),
});
