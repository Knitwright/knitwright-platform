import { leagueRulesInputSchema, listLeagueRules, saveLeagueRules } from "@/lib/print/profiles";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/** The brand's league rule sets. */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: {},
  handler: async ({ session }) => ({ ruleSets: await listLeagueRules(await sessionClient(), session.brand.id) }),
});

/** Adds a league rule set. Every one names where its rules came from. */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.printFiles,
  schema: { body: leagueRulesInputSchema },
  handler: async ({ input, session }) => ({
    id: await saveLeagueRules(adminClient(), { brandId: session.brand.id, userId: session.userId }, input.body),
  }),
});
