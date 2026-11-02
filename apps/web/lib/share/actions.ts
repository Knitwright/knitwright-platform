"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getEnv, turnstileSecret } from "@/lib/config/env";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, productionDeps } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { loadRow } from "@/lib/projects/project-reads";
import { sessionClient } from "@/lib/server/deps";
import { inviteMessage } from "./email";
import { inviteSender } from "./email-server";
import { createShareInvite, markShareInviteEmailed, revokeShareInvite, setShareLinkAudience } from "./invite-service";
import { createShareInviteSchema, inviteAddress, linkAudienceSchema, revokeShareInviteSchema } from "./invites";
import { keepAnswer } from "./respond";
import { createShareLinkSchema, shareLinkSchema, shareResponseSchema } from "./schemas";
import { createShareLink, moveShareLink, respondToShare, revokeShareLink } from "./service";
import { isVisitorKey, newVisitorKey, SHARE_VISITOR_COOKIE, shareAddress, visitorCookieOptions } from "./token";
import { verifyBotCheck } from "./turnstile";

/**
 * Share links (decision 0026). A member's actions take the user from the session and never a brand
 * from the form; the database checks that the user belongs to the design's brand. The visitor's
 * action needs no session: it is limited per address and per link, and guarded by the bot check.
 */

const refreshDesign = (projectId: string): void => revalidatePath(`/studio/${projectId}`);

/** Makes a link to the design's newest version. The address is returned once and never stored. */
export const createShareLinkAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.createShareLink,
  schema: createShareLinkSchema,
  handler: async ({ input, session }) => {
    const link = await createShareLink(adminClient(), { projectId: input.projectId, userId: session.userId, days: input.days });
    refreshDesign(input.projectId);
    return { address: shareAddress(getEnv().NEXT_PUBLIC_SITE_URL, link.token), version: link.version };
  },
});

export const revokeShareLinkAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.changeShareLink,
  schema: shareLinkSchema,
  handler: async ({ input, session }) => {
    await revokeShareLink(adminClient(), { linkId: input.linkId, userId: session.userId });
    refreshDesign(input.projectId);
    return { revoked: true };
  },
});

export const moveShareLinkAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.changeShareLink,
  schema: shareLinkSchema,
  handler: async ({ input, session }) => {
    const version = await moveShareLink(adminClient(), { linkId: input.linkId, userId: session.userId });
    refreshDesign(input.projectId);
    return { version };
  },
});

/**
 * Invites one address to the design (spec F-S4 Share, plan v5 Y8). The invite is made first, then
 * an email is attempted: without a provider key nothing is sent, the invite still stands, and the
 * answer carries its one-time link for the member to send themselves. `emailed` says what really
 * happened, so the People-with-access list never claims an email nobody sent.
 */
export const inviteToShareAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.createShareLink,
  schema: createShareInviteSchema,
  handler: async ({ input, session }) => {
    const admin = adminClient();
    const design = await loadRow(await sessionClient(), session.brand.id, input.projectId);
    const invite = await createShareInvite(admin, {
      projectId: input.projectId,
      userId: session.userId,
      email: input.email,
      access: input.access,
      message: input.message,
      days: input.days,
    });
    const address = inviteAddress(getEnv().NEXT_PUBLIC_SITE_URL, invite.token);
    const outcome = await inviteSender().send(
      inviteMessage({
        to: input.email,
        fromName: session.email ?? session.brand.name,
        replyTo: session.email,
        brandName: session.brand.name,
        designName: design.name,
        access: input.access,
        message: input.message,
        address,
      }),
    );
    if (outcome.sent) await markShareInviteEmailed(admin, { inviteId: invite.id, userId: session.userId });
    refreshDesign(input.projectId);
    return { address, access: input.access, replaced: invite.replaced, emailed: outcome.sent, emailNote: outcome.sent ? null : outcome.reason };
  },
});

export const revokeShareInviteAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.changeShareLink,
  schema: revokeShareInviteSchema,
  handler: async ({ input, session }) => {
    await revokeShareInvite(adminClient(), { inviteId: input.inviteId, userId: session.userId });
    refreshDesign(input.projectId);
    return { revoked: true };
  },
});

/** Sets the link to "Only invited people" or "Anyone with the link can view". */
export const setShareLinkAudienceAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.changeShareLink,
  schema: linkAudienceSchema,
  handler: async ({ input, session }) => {
    const audience = await setShareLinkAudience(adminClient(), { linkId: input.linkId, userId: session.userId, audience: input.audience });
    refreshDesign(input.projectId);
    return { audience };
  },
});

/** The visitor's key from their cookie, or a new one set in it. */
const visitorKey = async (): Promise<string> => {
  const store = await cookies();
  const known = store.get(SHARE_VISITOR_COOKIE)?.value;
  if (isVisitorKey(known)) return known;
  const fresh = newVisitorKey();
  store.set(SHARE_VISITOR_COOKIE, fresh, visitorCookieOptions(getEnv().NEXT_PUBLIC_SITE_URL));
  return fresh;
};

/** A vote, a comment or both, from someone a member sent the link to. */
export const respondToShareAction = defineAction({
  auth: "public",
  rateLimit: LIMITS.shareRespond,
  schema: shareResponseSchema,
  handler: async ({ input }) => {
    await keepAnswer(
      {
        hitLinkLimit: productionDeps.hitRateLimit,
        botCheck: (request) => verifyBotCheck({ ...request, send: fetch }),
        secret: turnstileSecret(getEnv()),
        address: await productionDeps.getClientAddress(),
        visitorKey: await visitorKey(),
        save: (answer) => respondToShare(adminClient(), answer),
      },
      input,
    );
    return { vote: input.vote, comment: input.comment };
  },
});
