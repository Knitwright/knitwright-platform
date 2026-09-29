import { z } from "zod";
import { defineRoute } from "@/lib/server/define-route";
import { sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { createDownloadLink } from "@/lib/storage/links";

/**
 * A link to one file of the brand the user is working in. The link stops working
 * after a minute. Files are reached this way and no other.
 */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.fileLink,
  schema: { params: z.object({ id: z.string().max(64) }) },
  handler: async ({ input, session }) =>
    createDownloadLink(await sessionClient(), session.brand.id, input.params.id),
});
