import { z } from "zod";
import { requireAbility, whoOf } from "@/lib/clubs/guards";
import { rosterNotes } from "@/lib/clubs/roster";
import { rosterBody } from "@/lib/clubs/schemas";
import { getRoster, replaceRoster } from "@/lib/clubs/service";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

const params = z.object({ seasonId: z.uuid() });

export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: { params },
  handler: async ({ input, session }) => {
    const players = await getRoster(await sessionClient(), session.brand.id, input.params.seasonId);
    return { players, notes: rosterNotes(players) };
  },
});

/** Replaces every player of the season in one step, so a roster is never half saved. */
export const PUT = defineRoute({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  maxBodyBytes: 400_000,
  schema: { params, body: rosterBody },
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const saved = await replaceRoster(adminClient(), whoOf(session), input.params.seasonId, input.body.players);
    return { saved, notes: rosterNotes(input.body.players) };
  },
});
