import { z } from "zod";
import { requireAbility, whoOf } from "@/lib/clubs/guards";
import { erasePlayer } from "@/lib/clubs/service";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

const params = z.object({ playerId: z.uuid() });

/** Erases one player's name, number and size: for someone who asks to be forgotten. */
export const DELETE = defineRoute({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: { params },
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    await erasePlayer(adminClient(), whoOf(session), input.params.playerId);
    return { erased: true };
  },
});
