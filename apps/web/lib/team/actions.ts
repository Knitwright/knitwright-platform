"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAbility, whoOf } from "@/lib/clubs/guards";
import { defineAction } from "@/lib/server/define-action";
import { adminClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { saveRetention } from "./retention";

const retentionSchema = z.object({ keep: z.enum(["on", "off"]).transform((value) => value === "on") });

/**
 * Team › Seasons' "Keep rosters after two seasons" (decision 0144 over D5's `set_roster_retention`).
 * The person comes from the session; the database checks they may manage members.
 */
export const setRosterRetentionAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: retentionSchema,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageMembers");
    await saveRetention(adminClient(), whoOf(session), input.keep);
    revalidatePath("/team");
    return { keep: input.keep };
  },
});
