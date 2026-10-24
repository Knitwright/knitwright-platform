"use server";

import { revalidatePath } from "next/cache";
import { defineAction } from "@/lib/server/define-action";
import { LIMITS } from "@/lib/server/limits";
import { opsContext } from "../qc/guard";
import { raiseFormSchema, resolveFormSchema, updateFormSchema } from "./schemas";
import { raiseException, resolveException, updateException } from "./service";

const ops = opsContext;

const refresh = (orderId: string) => {
  revalidatePath("/ops/exceptions");
  revalidatePath(`/ops/orders/${orderId}`);
  revalidatePath("/ops");
};

export const raiseExceptionAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.manageLeads,
  schema: raiseFormSchema,
  handler: async ({ input, session }) => {
    const { admin, actor } = await ops(session.userId);
    const id = await raiseException(admin, actor, input);
    refresh(input.orderId);
    return { id };
  },
});

export const updateExceptionAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.manageLeads,
  schema: updateFormSchema,
  handler: async ({ input, session }) => {
    const { admin, actor } = await ops(session.userId);
    await updateException(admin, actor, input.exceptionId, input.owner, input.dueOn, input.note);
    refresh(input.orderId);
    return { id: input.exceptionId };
  },
});

export const resolveExceptionAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.manageLeads,
  schema: resolveFormSchema,
  handler: async ({ input, session }) => {
    const { admin, actor } = await ops(session.userId);
    await resolveException(admin, actor, input.exceptionId, input.resolution);
    refresh(input.orderId);
    return { id: input.exceptionId };
  },
});
