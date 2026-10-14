import { z } from "zod";
import { deleteRuleSet } from "@/lib/print/server/rules";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/** Removes one of the brand's league rule sets. */
export const DELETE = defineRoute({
  auth: "member",
  rateLimit: LIMITS.printFiles,
  schema: { params: z.object({ ruleId: z.uuid() }) },
  handler: async ({ input, session }) => {
    await deleteRuleSet(adminClient(), { brandId: session.brand.id, userId: session.userId }, input.params.ruleId);
    return { removed: true };
  },
});
