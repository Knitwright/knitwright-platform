import { requireAbility, whoOf } from "@/lib/clubs/guards";
import { commentParams, resolveBody } from "@/lib/comments/schemas";
import { resolveComment } from "@/lib/comments/service";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/** Marks a thread resolved, or opens it again. Owners, admins and kit managers only (decision 0042); the database checks again. */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.commentChange,
  schema: { params: commentParams, body: resolveBody },
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    await resolveComment(adminClient(), whoOf(session), input.params.commentId, input.body.resolved);
    return { id: input.params.commentId, resolved: input.body.resolved };
  },
});
