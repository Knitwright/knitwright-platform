import { getEnv } from "@/lib/config/env";
import { creditSummaryFor } from "@/lib/credits/server";
import { defineRoute } from "@/lib/server/define-route";
import { LIMITS } from "@/lib/server/limits";

/**
 * The brand's credit balance, prices and history. There is no route that spends credits: a spend
 * belongs to the export that earns it, through `withCredits` (lib/credits-gate). `enforced` says
 * whether the owner has switched charging on.
 */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: {},
  handler: async ({ session }) => ({ ...(await creditSummaryFor(session.brand.id)), enforced: getEnv().CREDITS_ENFORCED }),
});
