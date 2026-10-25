"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/server/core/errors";
import { defineAction } from "@/lib/server/define-action";
import { sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { opsContext } from "../qc/guard";
import { loadOrder } from "../service";
import { bagsProblem, planBags } from "./bags";
import { cartonFormSchema, orderOnly, packBagFormSchema } from "./schemas";
import { loadTeamList, markBagPacked, setBags, setCarton } from "./service";

const ops = opsContext;

const refresh = (orderId: string) => revalidatePath(`/ops/orders/${orderId}/packing`);

/** Makes the bags of an order from its team list (or by size when there is none). Replaces them while none is packed. */
export const makeBagsAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.manageLeads,
  schema: orderOnly,
  handler: async ({ input, session }) => {
    const { admin, actor } = await ops(session.userId);
    const { order } = await loadOrder(await sessionClient(), input.orderId);
    const team = await loadTeamList(admin, order);
    const bags = planBags(order.sizes, team.roster);
    const problem = bagsProblem(bags);
    if (problem) throw new AppError("invalid_input", problem);
    const made = await setBags(admin, actor, order.id, team.teamOrderId, bags);
    refresh(order.id);
    return { bags: made };
  },
});

export const setCartonAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.manageLeads,
  schema: cartonFormSchema,
  handler: async ({ input, session }) => {
    const { admin, actor } = await ops(session.userId);
    await setCarton(admin, actor, input.orderId, input);
    refresh(input.orderId);
    return { cartonNo: input.cartonNo };
  },
});

export const packBagAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.manageLeads,
  schema: packBagFormSchema,
  handler: async ({ input, session }) => {
    const { admin, actor } = await ops(session.userId);
    await markBagPacked(admin, actor, input.bagId, input.cartonNo);
    refresh(input.orderId);
    return { bagId: input.bagId };
  },
});
