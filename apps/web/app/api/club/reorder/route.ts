import { previewBody } from "@/lib/clubs/reorder/schemas";
import { previewReorder } from "@/lib/clubs/reorder/use-cases";
import { defineRoute } from "@/lib/server/define-route";
import { sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/** What a reorder of an earlier order would do. Nothing is saved: the person looks first. */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: { body: previewBody },
  handler: async ({ input, session }) => previewReorder(await sessionClient(), session.brand, input.body),
});
