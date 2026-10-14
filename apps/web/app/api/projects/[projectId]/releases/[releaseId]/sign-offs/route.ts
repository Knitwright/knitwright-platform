import { z } from "zod";
import { signOffBody } from "@/lib/proofs/schemas";
import { sign } from "@/lib/proofs/use-cases";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/** Records who signed a release for a role, and when. A record is never changed or removed. */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.proofWrite,
  schema: { params: z.object({ projectId: z.uuid(), releaseId: z.uuid() }), body: signOffBody },
  handler: async ({ input, session }) => ({
    id: await sign(adminClient(), { brandId: session.brand.id, userId: session.userId }, input.params.releaseId, input.body, new Date()),
  }),
});
