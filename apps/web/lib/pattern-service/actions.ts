"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { opsContext } from "@/lib/ops/qc/guard";
import { defineAction } from "@/lib/server/define-action";
import { LIMITS } from "@/lib/server/limits";
import { moveSchema, reviewSchema } from "./schemas";
import { requestPatternForDesign } from "./server";
import { markReviewed, moveRequest } from "./service";

const refresh = (requestId: string, projectId?: string) => {
  revalidatePath("/ops/pattern-requests");
  revalidatePath(`/ops/pattern-requests/${requestId}`);
  if (projectId) revalidatePath(`/studio/${projectId}/pattern-service`);
};

/** A member sends the design's current version to the pattern service. A repeat for the same version changes nothing. */
export const requestPatternAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.requestQuote,
  schema: z.object({ projectId: z.uuid() }),
  handler: async ({ input, session }) => {
    const out = await requestPatternForDesign({ brandId: session.brand.id, userId: session.userId }, input.projectId);
    refresh(out.requestId, input.projectId);
    return { requestId: out.requestId, created: out.created, charged: out.charged };
  },
});

/** Ops accepts, starts, delivers or declines. Platform admins only; the database checks the actor again. */
export const moveRequestAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.manageLeads,
  schema: moveSchema,
  handler: async ({ input, session }) => {
    const { admin, actor } = await opsContext(session.userId);
    await moveRequest(admin, actor, input.requestId, input.to, input.note);
    refresh(input.requestId);
    return { id: input.requestId };
  },
});

/** Ops records the technician who reviewed the delivered files. */
export const markReviewedAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.manageLeads,
  schema: reviewSchema,
  handler: async ({ input, session }) => {
    const { admin, actor } = await opsContext(session.userId);
    await markReviewed(admin, actor, input.requestId, input.reviewerName);
    refresh(input.requestId);
    return { id: input.requestId };
  },
});
