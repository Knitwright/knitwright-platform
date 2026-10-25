import { z } from "zod";
import { mediaStore } from "@/lib/media/service";
import { setView } from "@/lib/media/view";
import { AppError } from "@/lib/server/core/errors";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/** One media set with its items, which the browser polls while it is being made. */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.pollJob,
  schema: { params: z.object({ projectId: z.uuid(), setId: z.uuid() }) },
  handler: async ({ input, session }) => {
    const set = await mediaStore(adminClient(), await sessionClient()).read(session.brand.id, input.params.projectId, input.params.setId);
    if (!set) throw new AppError("not_found", "That media set could not be found.");
    return { set: setView(set) };
  },
});
