import { requireAbility, whoOf } from "@/lib/clubs/guards";
import { getKit, saveKit } from "@/lib/clubs/service";
import { kitBody } from "@/lib/clubs/schemas";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/** The club's kit. */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: {},
  handler: async ({ session }) => ({ kit: await getKit(await sessionClient(), session.brand.id) }),
});

/** Replaces the kit. Owners, admins and kit managers only. */
export const PUT = defineRoute({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: { body: kitBody },
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    await saveKit(adminClient(), whoOf(session), input.body);
    return { kit: input.body };
  },
});
