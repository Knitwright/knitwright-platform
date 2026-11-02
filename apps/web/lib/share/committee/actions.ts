"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getEnv, turnstileSecret } from "@/lib/config/env";
import { requireAbility, whoOf } from "@/lib/clubs/guards";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, productionDeps } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { newShareToken, SHARE_VISITOR_COOKIE, isVisitorKey, newVisitorKey, shareAddress, visitorCookieOptions } from "../token";
import { verifyBotCheck } from "../turnstile";
import { guardCommitteeWrite } from "./respond";
import {
  committeeApproveSchema,
  committeeLinkSchema,
  committeePinSchema,
  committeeVoteSchema,
  createCommitteeLinkSchema,
  lockCommitteeVersionSchema,
} from "./schemas";
import {
  castVote,
  createCommitteeLink,
  lockCommitteeVersion,
  pinComment,
  recordApproval,
  revokeCommitteeLink,
} from "./service";

/**
 * Committee links (spec F-T3, plan v5 Z7, decision 0087). A club's actions take the user from the
 * session and never a club from the form; the database checks the person's role itself. The
 * committee's actions need no session: each is limited per address and per link, and guarded by the
 * bot check, exactly as a share answer is (decision 0026).
 */

const refreshDesign = (projectId: string): void => {
  revalidatePath(`/studio/${projectId}`);
  revalidatePath("/collect");
};

/** The visitor's key from their cookie, or a new one set in it. The same cookie a share page uses. */
const visitorKey = async (): Promise<string> => {
  const store = await cookies();
  const known = store.get(SHARE_VISITOR_COOKIE)?.value;
  if (isVisitorKey(known)) return known;
  const fresh = newVisitorKey();
  store.set(SHARE_VISITOR_COOKIE, fresh, visitorCookieOptions(getEnv().NEXT_PUBLIC_SITE_URL));
  return fresh;
};

/** What every committee write shares: the bot check, the address and the link's own limit. */
const writeDeps = async () => ({
  hitLinkLimit: productionDeps.hitRateLimit,
  botCheck: (request: Readonly<{ secret: string; token: string; address: string }>) => verifyBotCheck({ ...request, send: fetch }),
  secret: turnstileSecret(getEnv()),
  address: await productionDeps.getClientAddress(),
  rule: LIMITS.committeeWriteLink,
});

/** Makes a link showing up to three versions, read only. The address is returned once and never stored. */
export const createCommitteeLinkAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.manageCommitteeLink,
  schema: createCommitteeLinkSchema,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const link = await createCommitteeLink(adminClient(), {
      projectId: input.projectId,
      userId: whoOf(session).userId,
      token: newShareToken(),
      versions: input.versions,
    });
    refreshDesign(input.projectId);
    return { address: shareAddress(getEnv().NEXT_PUBLIC_SITE_URL, link.token), expiresAt: link.expiresAt };
  },
});

export const revokeCommitteeLinkAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.manageCommitteeLink,
  schema: committeeLinkSchema,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    await revokeCommitteeLink(adminClient(), { linkId: input.linkId, userId: session.userId });
    refreshDesign(input.projectId);
    return { revoked: true };
  },
});

/** The kit manager locks the version the committee approved, which moves it to status approved. */
export const lockCommitteeVersionAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.manageCommitteeLink,
  schema: lockCommitteeVersionSchema,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const lockId = await lockCommitteeVersion(adminClient(), { linkId: input.linkId, userId: session.userId, version: input.version });
    refreshDesign(input.projectId);
    return { lockId, version: input.version };
  },
});

/** A comment pinned to a point on a panel, by someone with no account. */
export const committeePinAction = defineAction({
  auth: "public",
  rateLimit: LIMITS.committeeWrite,
  schema: committeePinSchema,
  handler: async ({ input }) => {
    const key = await visitorKey();
    await guardCommitteeWrite(await writeDeps(), input, () =>
      pinComment(adminClient(), {
        token: input.token,
        visitorKey: key,
        name: input.name,
        version: input.version,
        panelId: input.panelId,
        xMm: input.xMm,
        yMm: input.yMm,
        body: input.body,
      }),
    );
    return { pinned: true };
  },
});

/** A vote on one of the options the link shows. */
export const committeeVoteAction = defineAction({
  auth: "public",
  rateLimit: LIMITS.committeeWrite,
  schema: committeeVoteSchema,
  handler: async ({ input }) => {
    const key = await visitorKey();
    await guardCommitteeWrite(await writeDeps(), input, () =>
      castVote(adminClient(), { token: input.token, visitorKey: key, name: input.name, slot: input.slot }),
    );
    return { slot: input.slot };
  },
});

/** An approval, recorded with the name, the time and the version. Immutable once written. */
export const committeeApproveAction = defineAction({
  auth: "public",
  rateLimit: LIMITS.committeeWrite,
  schema: committeeApproveSchema,
  handler: async ({ input }) => {
    const key = await visitorKey();
    const approvalId = await guardCommitteeWrite(await writeDeps(), input, () =>
      recordApproval(adminClient(), {
        token: input.token,
        visitorKey: key,
        name: input.name,
        email: input.email,
        version: input.version,
      }),
    );
    return { approvalId, version: input.version };
  },
});
