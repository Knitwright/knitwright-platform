import { z } from "zod";
import { receiveStrikeOffBody } from "@/lib/proofs/schemas";
import { receiveStrikeOff } from "@/lib/proofs/service";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/** Records that the strike-off arrived, with the shrink measured on it, a note for each colour and its photos. */
export const PUT = defineRoute({
  auth: "member",
  rateLimit: LIMITS.proofWrite,
  schema: { params: z.object({ projectId: z.uuid(), proofId: z.uuid() }), body: receiveStrikeOffBody },
  handler: async ({ input, session }) => {
    await receiveStrikeOff(adminClient(), { brandId: session.brand.id, userId: session.userId }, { strikeOffId: input.params.proofId, ...input.body });
    return { received: true as const };
  },
});
