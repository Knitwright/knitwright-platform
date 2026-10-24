import { z } from "zod";
import { requireAbility, whoOf } from "@/lib/clubs/guards";
import { cancelInvitation } from "@/lib/clubs/service";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

const params = z.object({ invitationId: z.uuid() });

export const DELETE = defineRoute({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: { params },
  handler: async ({ input, session }) => {
    requireAbility(session, "manageMembers");
    await cancelInvitation(adminClient(), whoOf(session), input.params.invitationId);
    return { cancelled: true };
  },
});
