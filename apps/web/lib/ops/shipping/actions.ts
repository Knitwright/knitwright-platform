"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/server/core/errors";
import { defineAction } from "@/lib/server/define-action";
import { LIMITS } from "@/lib/server/limits";
import { opsContext } from "../qc/guard";
import { listCouriers, selectCourierProvider } from "./courier";
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
    const couriers = await listCouriers(admin);
    const courierRow = couriers.find((c) => c.code === input.courierCode) ?? null;
    if (input.courierCode !== "" && courierRow === null) throw new AppError("invalid_input", "That courier is not on file.", { courierCode: ["That courier is not on file."] });
    const recorded = await recordShipment(admin, actor, { ...input, rest: restOf(input), courierRow }, selectCourierProvider());
    revalidatePath(`/ops/orders/${input.orderId}`);
    revalidatePath(`/ops/orders/${input.orderId}/shipping`);
    revalidatePath("/ops/exceptions");
    revalidatePath("/ops");
    return { complete: recorded.complete, pieces: recorded.pieces, outcome: recorded.outcome, trackingUrl: recorded.trackingUrl };
  },
});
