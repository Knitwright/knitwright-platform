import { z } from "zod";
import { openRelease } from "@/lib/releases/use-cases";
import { defineRoute } from "@/lib/server/define-route";
import { sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/** A release with its files and their hashes, who signed, and the strike-offs. */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: { params: z.object({ projectId: z.uuid(), releaseId: z.uuid() }) },
  handler: async ({ input, session }) => openRelease(await sessionClient(), session.brand.id, input.params.projectId, input.params.releaseId),
});
