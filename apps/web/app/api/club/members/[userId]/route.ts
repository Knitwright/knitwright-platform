import { z } from "zod";
import { requireAbility, whoOf } from "@/lib/clubs/guards";
import { roleBody } from "@/lib/clubs/schemas";
import { removeMember, setMemberRole } from "@/lib/clubs/service";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

const params = z.object({ userId: z.uuid() });

/** Changes a member's role. Owners and admins only; the owner's role never changes. */
export const PUT = defineRoute({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: { params, body: roleBody },
  handler: async ({ input, session }) => {
    requireAbility(session, "manageMembers");
    await setMemberRole(adminClient(), whoOf(session), input.params.userId, input.body.role);
    return { changed: true };
  },
});

/** Removes a member, or lets someone leave. Anyone may remove themselves; removing others needs owner or admin. The database decides. */
export const DELETE = defineRoute({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: { params },
  handler: async ({ input, session }) => {
    await removeMember(adminClient(), whoOf(session), input.params.userId);
    return { removed: true };
  },
});
