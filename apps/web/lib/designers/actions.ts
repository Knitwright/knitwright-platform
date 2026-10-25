"use server";

import { revalidatePath } from "next/cache";
import { assertPlatformAdmin } from "@/lib/ops/access";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { acceptSubmissionSchema, enrolSchema, newSubmissionSchema, payoutStateSchema, rejectSubmissionSchema, sendSubmissionSchema } from "./schemas";
import { acceptSubmission, createSubmission, enrol, rejectSubmission, sendSubmission, setPayoutState } from "./service";

/**
 * The designer actions (decision 0061). The person always comes from the session. The review and payout actions are for
 * platform admins only: they ask the database, answer "not found" to anyone else, and the database functions check the actor again.
 */

const reviewer = async (userId: string) => {
  await assertPlatformAdmin(await sessionClient());
  return { admin: adminClient(), actor: userId };
};

export const enrolAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.createProject,
  schema: enrolSchema,
  handler: async ({ input, session }) => {
    await enrol(adminClient(), session.userId, input.displayName);
    revalidatePath("/designer");
    return { enrolled: true };
  },
});

export const newSubmissionAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.createProject,
  schema: newSubmissionSchema,
  handler: async ({ input, session }) => {
    const id = await createSubmission(adminClient(), await sessionClient(), session.userId, input);
    revalidatePath("/designer");
    return { id };
  },
});

export const sendSubmissionAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.createProject,
  schema: sendSubmissionSchema,
  handler: async ({ input, session }) => {
    await sendSubmission(adminClient(), session.userId, input.submissionId);
    revalidatePath("/designer");
    return { sent: true };
  },
});

export const acceptSubmissionAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.manageLeads,
  schema: acceptSubmissionSchema,
  handler: async ({ input, session }) => {
    const { admin, actor } = await reviewer(session.userId);
    const templateId = await acceptSubmission(admin, actor, input.submissionId);
    revalidatePath("/admin/templates");
    revalidatePath("/templates");
    return { templateId };
  },
});

export const rejectSubmissionAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.manageLeads,
  schema: rejectSubmissionSchema,
  handler: async ({ input, session }) => {
    const { admin, actor } = await reviewer(session.userId);
    await rejectSubmission(admin, actor, input.submissionId, input.reason);
    revalidatePath("/admin/templates");
    return { rejected: true };
  },
});

export const payoutStateAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.manageLeads,
  schema: payoutStateSchema,
  handler: async ({ input, session }) => {
    const { admin, actor } = await reviewer(session.userId);
    await setPayoutState(admin, actor, input.designerId, input.state, input.note);
    revalidatePath("/admin/templates");
    return { state: input.state };
  },
});
