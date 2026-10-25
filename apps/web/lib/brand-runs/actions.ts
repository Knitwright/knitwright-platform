"use server";

import { revalidatePath } from "next/cache";
import { requireAbility, whoOf } from "@/lib/clubs/guards";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { placeOrder } from "./place-order";
import { productBody, runBody, stageBody } from "./schemas";
import { confirmStage, createProduct } from "./service";

/**
 * The brand workspace's actions. The brand and the person always come from the session; the role is checked here for a clear
 * answer and again inside every database function.
 */

export const addProductAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: productBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const id = await createProduct(adminClient(), whoOf(session), input);
    revalidatePath("/brand");
    return { id };
  },
});

export const confirmStageAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: stageBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const stage = await confirmStage(adminClient(), whoOf(session), input.productId, input.to);
    revalidatePath("/brand");
    return { stage };
  },
});

export const orderRunAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: runBody,
  handler: async ({ input, session }) => {
    const sent = await placeOrder({ client: await sessionClient(), admin: adminClient() }, whoOf(session), session.brand.role, input);
    revalidatePath("/brand");
    return sent;
  },
});
