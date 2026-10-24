import { requireAbility, whoOf } from "@/lib/clubs/guards";
import { seasonBody } from "@/lib/clubs/schemas";
import { createSeason, listSeasons } from "@/lib/clubs/service";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: {},
  handler: async ({ session }) => ({ seasons: await listSeasons(await sessionClient(), session.brand.id) }),
});

/** Makes a season, empty or starting from an earlier season's players and sizes. */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: { body: seasonBody },
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    return { id: await createSeason(adminClient(), whoOf(session), input.body) };
  },
});
