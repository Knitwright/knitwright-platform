import { z } from "zod";
import { requireAbility, whoOf } from "@/lib/clubs/guards";
import { deleteSeason } from "@/lib/clubs/service";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

const params = z.object({ seasonId: z.uuid() });

/** Erases a season and every player in it. */
export const DELETE = defineRoute({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: { params },
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    await deleteSeason(adminClient(), whoOf(session), input.params.seasonId);
    return { deleted: true };
  },
});
