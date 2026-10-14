import { z } from "zod";
import { decideStrikeOffBody } from "@/lib/proofs/schemas";
import { decide } from "@/lib/proofs/use-cases";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/** A named person, with their role and a date, accepts or rejects a strike-off that has arrived. It is then locked. */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.proofWrite,
  schema: { params: z.object({ projectId: z.uuid(), proofId: z.uuid() }), body: decideStrikeOffBody },
  handler: async ({ input, session }) => {
    await decide(adminClient(), { brandId: session.brand.id, userId: session.userId }, input.params.proofId, input.body, new Date());
    return { decided: true as const };
  },
});
