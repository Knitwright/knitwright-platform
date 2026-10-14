import { z } from "zod";
import { requestStrikeOffBody } from "@/lib/proofs/schemas";
import { listStrikeOffs, requestStrikeOff } from "@/lib/proofs/service";
import { strikeOffSentence } from "@/lib/proofs/sentences";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

const params = z.object({ projectId: z.uuid() });

export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: { params },
  handler: async ({ input, session }) => ({
    strikeOffs: (await listStrikeOffs(await sessionClient(), session.brand.id, input.params.projectId)).map((s) => ({ ...s, sentence: strikeOffSentence(s) })),
  }),
});

/** Asks for a strike-off (a test print on the real fabric) against a release. */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.proofWrite,
  schema: { params, body: requestStrikeOffBody.extend({ releaseId: z.uuid() }) },
  handler: async ({ input, session }) => ({
    id: await requestStrikeOff(adminClient(), { brandId: session.brand.id, userId: session.userId }, { releaseId: input.body.releaseId, note: input.body.note }),
  }),
});
