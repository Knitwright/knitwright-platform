import { creditSummaryFor } from "@/lib/credits/server";
import { defineRoute } from "@/lib/server/define-route";
import { LIMITS } from "@/lib/server/limits";

/**
 * The brand's credit balance, prices and history. There is no route that spends credits: a spend
 * belongs to the export that earns it (wave 2), called from the server with `spendCredits`.
 */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: {},
  handler: async ({ session }) => creditSummaryFor(session.brand.id),
});
