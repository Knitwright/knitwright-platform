import { z } from "zod";
import { withCredits } from "@/lib/credits-gate/server";
import { mediaStore } from "@/lib/media/service";
import { NOT_FINISHED_MESSAGE, unlockSet } from "@/lib/media/unlock";
import { AppError } from "@/lib/server/core/errors";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/**
 * Spends the credits for the set's design version and unlocks the set, so its clean pictures are served. The spend is
 * once per brand, kind and version (decision 0051), so pressing it twice, or after the photoreal images of the same
 * version were paid for, charges once. With credits not enforced nothing is charged and the log says what would have been.
 */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.printFiles,
  schema: { params: z.object({ projectId: z.uuid(), setId: z.uuid() }), body: z.object({}) },
  handler: withCredits(
    {
      kind: "marketing_media",
      version: async ({ input, session }) => {
        const set = await mediaStore(adminClient(), await sessionClient()).read(session.brand.id, input.params.projectId, input.params.setId);
        if (!set) throw new AppError("not_found", "That media set could not be found.");
        // Refused before the charge: credits are never spent on a set that is not finished.
        if (set.status !== "succeeded") throw new AppError("conflict", NOT_FINISHED_MESSAGE);
        return { projectId: set.projectId, version: set.version };
      },
      where: "POST /api/projects/[projectId]/media/[setId]/unlock",
    },
    async ({ input, session }) =>
      unlockSet(mediaStore(adminClient(), await sessionClient()), {
        brandId: session.brand.id,
        projectId: input.params.projectId,
        setId: input.params.setId,
        userId: session.userId,
      }),
  ),
});
