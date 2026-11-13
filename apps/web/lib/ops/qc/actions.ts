"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAction } from "@/lib/server/define-action";
import { LIMITS } from "@/lib/server/limits";
import { opsContext } from "./guard";
import { inspectionFormSchema } from "./schemas";
import { recordInspection, shareQcPhotos } from "./service";

const ops = opsContext;

/** Records a quality inspection of an order the factory has marked ready (decision 0050). Platform admins only. */
export const recordInspectionAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.manageLeads,
  schema: inspectionFormSchema,
  handler: async ({ input, session }) => {
    const { admin, actor } = await ops(session.userId);
    const recorded = await recordInspection(admin, actor, input);
    revalidatePath(`/ops/orders/${input.orderId}`);
    revalidatePath(`/ops/orders/${input.orderId}/qc`);
    revalidatePath("/ops");
    revalidatePath("/ops/exceptions");
    return { result: recorded.result, remakeOpened: recorded.exceptionId !== null };
  },
});

/** Shows or hides one inspection's photos on the customer's order page (decision 0143). Platform admins only. */
export const shareQcPhotosAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.manageLeads,
  schema: z.object({ orderId: z.uuid(), inspectionId: z.uuid(), shared: z.boolean() }),
  handler: async ({ input, session }) => {
    const { admin, actor } = await ops(session.userId);
    await shareQcPhotos(admin, actor, { inspectionId: input.inspectionId, shared: input.shared });
    revalidatePath(`/ops/orders/${input.orderId}/qc`);
    revalidatePath(`/orders/${input.orderId}`);
    return { shared: input.shared };
  },
});
