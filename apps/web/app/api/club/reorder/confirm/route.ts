import { requireAbility, whoOf } from "@/lib/clubs/guards";
import { confirmBody } from "@/lib/clubs/reorder/schemas";
import { confirmReorder } from "@/lib/clubs/reorder/use-cases";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/** Makes the new team order from the plan the person looked at. Kit managers and above only. */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: { body: confirmBody },
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    return confirmReorder({ client: await sessionClient(), admin: adminClient() }, whoOf(session), session.brand, input.body);
  },
});
