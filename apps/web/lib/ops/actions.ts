"use server";

import { revalidatePath } from "next/cache";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { AppError } from "@/lib/server/core/errors";
import { assertPlatformAdmin } from "./access";
import { cutFormSchema, delayFormSchema, holdFormSchema, moveFormSchema, settingsFormSchema, statusFormSchema } from "./schemas";
import { cutBatches, delayOrder, loadOrder, moveOrder, saveSettings, setHold, setOrderStatus } from "./service";
import { checkDelay } from "./status";

/**
 * The ops console's actions (decision 0043). Each one is for platform admins only: it asks the database whether
 * the signed-in person is one, and answers "not found" if not. The writes run as the server's key with the
 * person's id as the actor, and the database functions check the actor again.
 */

const ops = async (userId: string) => {
  await assertPlatformAdmin(await sessionClient());
  return { admin: adminClient(), actor: userId };
};

const refresh = (orderId?: string) => {
  revalidatePath("/ops");
  if (orderId) revalidatePath(`/ops/orders/${orderId}`);
};

/** Puts every waiting order whose cut-off has come into its batch. */
export const cutBatchesAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.manageLeads,
  schema: cutFormSchema,
  handler: async ({ session }) => {
    const { admin, actor } = await ops(session.userId);
    const batched = await cutBatches(admin, actor);
    refresh();
    return { batched };
  },
});

export const setStatusAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.manageLeads,
  schema: statusFormSchema,
  handler: async ({ input, session }) => {
    const { admin, actor } = await ops(session.userId);
    await setOrderStatus(admin, actor, input.orderId, input.to);
    refresh(input.orderId);
    return { status: input.to };
  },
});

export const setHoldAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.manageLeads,
  schema: holdFormSchema,
  handler: async ({ input, session }) => {
    const { admin, actor } = await ops(session.userId);
    await setHold(admin, actor, input.orderId, input.hold, input.note);
    refresh(input.orderId);
    return { hold: input.hold };
  },
});

export const moveOrderAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.manageLeads,
  schema: moveFormSchema,
  handler: async ({ input, session }) => {
    const { admin, actor } = await ops(session.userId);
    await moveOrder(admin, actor, input.orderId, input.batchId, input.note);
    refresh(input.orderId);
    return { batchId: input.batchId };
  },
});

export const delayOrderAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.manageLeads,
  schema: delayFormSchema,
  handler: async ({ input, session }) => {
    const { admin, actor } = await ops(session.userId);
    const { order } = await loadOrder(await sessionClient(), input.orderId);
    const problem = checkDelay({ current: order.promisedOn, next: input.promisedOn, reason: input.reason });
    if (problem) throw new AppError("invalid_input", problem, { promisedOn: [problem] });
    await delayOrder(admin, actor, input.orderId, input.promisedOn, input.reason);
    refresh(input.orderId);
    return { promisedOn: input.promisedOn };
  },
});

export const saveSettingsAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.manageLeads,
  schema: settingsFormSchema,
  handler: async ({ input, session }) => {
    const { admin, actor } = await ops(session.userId);
    await saveSettings(admin, actor, input);
    revalidatePath("/ops/settings");
    refresh();
    return { saved: true };
  },
});
