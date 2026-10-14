import { z } from "zod";
import { deleteLeagueRules, leagueRulesInputSchema, updateLeagueRules } from "@/lib/print/profiles";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

const params = z.object({ ruleId: z.uuid() });

/** Replaces a league rule set. */
export const PUT = defineRoute({
  auth: "member",
  rateLimit: LIMITS.printFiles,
  schema: { params, body: leagueRulesInputSchema },
  handler: async ({ input, session }) => {
    await updateLeagueRules(adminClient(), { brandId: session.brand.id, userId: session.userId }, input.params.ruleId, input.body);
    return { saved: true };
  },
});

/** Removes a league rule set. */
export const DELETE = defineRoute({
  auth: "member",
  rateLimit: LIMITS.printFiles,
  schema: { params },
  handler: async ({ input, session }) => {
    await deleteLeagueRules(adminClient(), { brandId: session.brand.id, userId: session.userId }, input.params.ruleId);
    return { deleted: true };
  },
});
