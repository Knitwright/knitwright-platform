"use server";

import { revalidatePath } from "next/cache";
import { getEnv, turnstileSecret } from "@/lib/config/env";
import { opsContext } from "@/lib/ops/qc/guard";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, productionDeps } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { log } from "@/lib/server/log";
import { verifyBotCheck } from "@/lib/share/turnstile";
import { reportSchema, submitReport } from "./report";
import { addMark, decideNotice, markActiveSchema, markSchema, noticeDecisionSchema, reviewCheck, reviewSchema, saveReport, setMarkActive } from "./review";

/** The moderation actions (decision 0073). The ops ones ask the database whether the caller is a platform admin first. */

const REVIEW_PATH = "/ops/review";

/**
 * A rights holder reports a mark used without permission. No account: limited per address, guarded by the bot check, and kept by
 * takedown_submit. The answer says nothing about what Knitwright holds.
 */
export const reportMarkAction = defineAction({
  auth: "public",
  rateLimit: LIMITS.requestAccess,
  schema: reportSchema,
  handler: async ({ input }) => {
    const id = await submitReport(
      {
        botCheck: (request) => verifyBotCheck({ ...request, send: fetch }),
        secret: turnstileSecret(getEnv()),
        address: await productionDeps.getClientAddress(),
        save: (report) => saveReport(adminClient(), report),
      },
      input,
    );
    // No mail sender exists yet (owner action A4): ops reads new notices on the review page.
    log({ level: "info", where: "takedown-notice", message: `New takedown notice ${id}. See ${REVIEW_PATH}.` });
    return { email: input.reporterEmail };
  },
});

/** Ops allows or blocks a flagged item, with a reason. */
export const reviewCheckAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.manageLeads,
  schema: reviewSchema,
  handler: async ({ input, session }) => {
    const { admin, actor } = await opsContext(session.userId);
    await reviewCheck(admin, actor, input);
    revalidatePath(REVIEW_PATH);
    return { id: input.checkId };
  },
});

/** Ops upholds or rejects a takedown notice. Upholding names the brand and counts a strike against it. */
export const decideNoticeAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.manageLeads,
  schema: noticeDecisionSchema,
  handler: async ({ input, session }) => {
    const { admin, actor } = await opsContext(session.userId);
    const strike = await decideNotice(admin, actor, input);
    revalidatePath(REVIEW_PATH);
    return { id: input.noticeId, strike };
  },
});

/** Ops adds a mark to the registry by name (a picture is added through the marks route). */
export const addMarkAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.manageLeads,
  schema: markSchema,
  handler: async ({ input, session }) => {
    const { admin, actor } = await opsContext(session.userId);
    const id = await addMark(admin, actor, input);
    revalidatePath(REVIEW_PATH);
    return { id };
  },
});

/** Ops switches a mark on or off. */
export const setMarkActiveAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.manageLeads,
  schema: markActiveSchema,
  handler: async ({ input, session }) => {
    const { admin, actor } = await opsContext(session.userId);
    await setMarkActive(admin, actor, input);
    revalidatePath(REVIEW_PATH);
    return { id: input.markId };
  },
});
