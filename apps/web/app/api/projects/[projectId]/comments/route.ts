import { whoOf } from "@/lib/clubs/guards";
import { createBody, projectParams } from "@/lib/comments/schemas";
import { addComment, listComments } from "@/lib/comments/service";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/** The design's comments, the members who can be named, and who is looking. Members only: no share link reaches this. */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: { params: projectParams },
  handler: async ({ input, session }) => listComments(await sessionClient(), { ...whoOf(session), role: session.brand.role }, input.params.projectId),
});

/** Adds a comment, or a reply when `parentId` is given. Every member may comment, viewers included. */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.commentWrite,
  maxBodyBytes: 40_000,
  schema: { params: projectParams, body: createBody },
  handler: async ({ input, session }) => ({ id: await addComment(adminClient(), whoOf(session), input.params.projectId, input.body) }),
});
