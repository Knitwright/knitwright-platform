import { requireAbility, whoOf } from "@/lib/clubs/guards";
import { inviteBody } from "@/lib/clubs/schemas";
import { inviteMember, listInvitations, listMembers } from "@/lib/clubs/service";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/** The club's members and, for people who manage members, its open invitations. */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: {},
  handler: async ({ session }) => {
    const client = await sessionClient();
    const [members, invitations] = await Promise.all([listMembers(client, session.brand.id), listInvitations(client, session.brand.id)]);
    return { members, invitations };
  },
});

/** Invites a person by email address. They join when they sign in with that address and accept. */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: { body: inviteBody },
  handler: async ({ input, session }) => {
    requireAbility(session, "manageMembers");
    await inviteMember(adminClient(), whoOf(session), input.body.email, input.body.role);
    return { invited: true };
  },
});
