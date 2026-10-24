import { z } from "zod";
import { acceptInvitation } from "@/lib/clubs/service";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

const params = z.object({ invitationId: z.uuid() });

/** Joins the club an invitation names. Only the person whose confirmed address it names can accept it. */
export const POST = defineRoute({
  auth: "user",
  rateLimit: LIMITS.clubWrite,
  schema: { params },
  handler: async ({ input, session }) => ({ brandId: await acceptInvitation(adminClient(), session.userId, input.params.invitationId) }),
});
