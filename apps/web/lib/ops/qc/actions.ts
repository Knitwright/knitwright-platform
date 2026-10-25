"use server";

import { revalidatePath } from "next/cache";
import { defineAction } from "@/lib/server/define-action";
import { LIMITS } from "@/lib/server/limits";
import { opsContext } from "./guard";
import { inspectionFormSchema } from "./schemas";
import { recordInspection } from "./service";

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
