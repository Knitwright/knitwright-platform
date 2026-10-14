import { createRuleSet, listRuleSets } from "@/lib/print/server/rules";
import { leagueRuleSetInputSchema } from "@/lib/print/server/schemas";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/** The brand's league rule sets, each with the source it was read from. None ships. */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: {},
  handler: async ({ session }) => ({ ruleSets: await listRuleSets(await sessionClient(), session.brand.id) }),
});

/** Adds a rule set. A rule set without a source is refused. */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.printFiles,
  schema: { body: leagueRuleSetInputSchema },
  handler: async ({ input, session }) => ({
    id: await createRuleSet(adminClient(), { brandId: session.brand.id, userId: session.userId }, input.body),
  }),
});
