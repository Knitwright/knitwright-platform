"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/server/core/errors";
import { defineAction } from "@/lib/server/define-action";
import { LIMITS } from "@/lib/server/limits";
import { opsContext } from "../qc/guard";
import { restOf, restProblem, shipmentFormSchema } from "./schemas";
import { recordShipment } from "./service";

const ops = opsContext;

/** Records a parcel sent for an order. The database refuses unless the order is ready and its latest inspection passes. */
export const recordShipmentAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.manageLeads,
  schema: shipmentFormSchema,
  handler: async ({ input, session }) => {
    const { admin, actor } = await ops(session.userId);
    const problem = restProblem(input);
    if (problem) throw new AppError("invalid_input", problem, { restOwner: [problem] });
    const recorded = await recordShipment(admin, actor, { ...input, rest: restOf(input) });
    revalidatePath(`/ops/orders/${input.orderId}`);
    revalidatePath(`/ops/orders/${input.orderId}/shipping`);
    revalidatePath("/ops/exceptions");
    revalidatePath("/ops");
    return { complete: recorded.complete, pieces: recorded.pieces };
  },
});
