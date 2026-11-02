import { loadUploads } from "@/lib/launch-panels/uploads";
import { defineRoute } from "@/lib/server/define-route";
import { sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/**
 * The brand's own uploads for the launch rail's Uploads panel, newest first, each with the rights
 * recorded on it (decision 0106). The brand comes from the session, never from the request, and the
 * read goes through the person's own client so the database's rules decide as well as this code.
 */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: {},
  handler: async ({ session }) => loadUploads(await sessionClient(), session.brand.id),
});
