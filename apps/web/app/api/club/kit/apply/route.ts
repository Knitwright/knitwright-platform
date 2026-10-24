import { requireAbility, whoOf } from "@/lib/clubs/guards";
import { applyKitBody } from "@/lib/clubs/schemas";
import { applyKitToDesign } from "@/lib/clubs/apply-to-design";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/** Puts the club's colours, crest and sponsors on one design as a new version. The design keeps its own copy. */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.editDesign,
  schema: { body: applyKitBody },
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    return applyKitToDesign({ client: await sessionClient(), admin: adminClient() }, whoOf(session), input.body);
  },
});
