"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getEnv, turnstileSecret } from "@/lib/config/env";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, productionDeps } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
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
