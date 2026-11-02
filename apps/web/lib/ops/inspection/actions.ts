"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/server/core/errors";
import { defineAction } from "@/lib/server/define-action";
import { LIMITS } from "@/lib/server/limits";
import { loadOrder } from "../service";
import { opsContext } from "../qc/guard";
import { sessionClient } from "@/lib/server/deps";
import { loadThirdPartyOverPieces } from "./load";
import { bookingBlocker } from "./rules";
import { bookInspectionSchema } from "./schemas";
import { bookInspection, listBookings } from "./service";
import { selectInspectionProvider } from "./provider";

const ops = opsContext;

/**
 * Asks for a third-party inspection of a run over the threshold (F-O3). The provider is the stub, so nothing
 * is called and nothing is paid for: the answer is recorded as given, and ops is told what to do next.
 */
export const bookInspectionAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.manageLeads,
  schema: bookInspectionSchema,
  handler: async ({ input, session }) => {
    const { admin, actor } = await ops(session.userId);
    const client = await sessionClient();
    const [{ order }, bookings, overPieces] = await Promise.all([
      loadOrder(client, input.orderId),
      listBookings(client, input.orderId),
      loadThirdPartyOverPieces(admin),
    ]);
    const blocker = bookingBlocker({ pieces: order.pieces, overPieces, status: order.status, alreadyBooked: bookings.length > 0 });
    if (blocker) throw new AppError("conflict", blocker);
    const booked = await bookInspection(
      admin,
      actor,
      { ...input, orderRef: order.externalRef, pieces: order.pieces },
      selectInspectionProvider(),
    );
    revalidatePath(`/ops/orders/${input.orderId}`);
    revalidatePath(`/ops/orders/${input.orderId}/qc`);
    return { state: booked.state, reference: booked.reference, outcome: booked.outcome };
  },
});
