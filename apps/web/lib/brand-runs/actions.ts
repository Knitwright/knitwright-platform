"use server";

import { revalidatePath } from "next/cache";
import { requireAbility, whoOf } from "@/lib/clubs/guards";
import { orderValidationGate } from "@/lib/make/order-gate";
import { humanReviewGate, orderGate } from "@/lib/moderation/server";
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
    revalidatePath("/orders/runs");
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
    revalidatePath("/orders/runs");
    return { stage };
  },
});

export const orderRunAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: runBody,
  handler: async ({ input, session }) => {
    const who = whoOf(session);
    const client = await sessionClient();
    const admin = adminClient();
    const sent = await placeOrder(
      { client, admin },
      who,
      session.brand.role,
      input,
      {
        // Before every order (spec F-G1; security review v5 H3, decision 0116).
        order: orderGate({ brandId: who.brandId, userId: who.userId }, "brand run order"),
        humanReview: humanReviewGate(),
      },
      // The version's own checks and the F-G2 checklist (plan v6 D1, decision 0132). The brand workspace
      // works in GBP, so its pieces are labelled for the United Kingdom.
      orderValidationGate({ client, admin, who, brandName: session.brand.name, country: "GB" }),
    );
    revalidatePath("/orders/runs");
    return sent;
  },
});
