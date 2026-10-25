import { whoOf } from "@/lib/clubs/guards";
import { COMMENT_LIMITS } from "@/lib/comments/limits";
import { commentParams, editBody } from "@/lib/comments/schemas";
import { deleteComment, editComment } from "@/lib/comments/service";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient } from "@/lib/server/deps";

/** Changes the words of one's own comment, for a short time after writing it. The earlier words are kept. */
export const PATCH = defineRoute({
  auth: "member",
  rateLimit: COMMENT_LIMITS.change,
  maxBodyBytes: 40_000,
  schema: { params: commentParams, body: editBody },
  handler: async ({ input, session }) => {
    await editComment(adminClient(), whoOf(session), input.params.commentId, input.body);
    return { id: input.params.commentId };
  },
});

/** Removes one's own comment, for a short time after writing it. */
export const DELETE = defineRoute({
  auth: "member",
  rateLimit: COMMENT_LIMITS.change,
  schema: { params: commentParams },
  handler: async ({ input, session }) => ({ outcome: await deleteComment(adminClient(), whoOf(session), input.params.commentId) }),
});
