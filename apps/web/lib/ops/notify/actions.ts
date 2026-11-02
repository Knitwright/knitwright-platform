"use server";

import { revalidatePath } from "next/cache";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { brandNameOf } from "../packing/service";
import { opsContext } from "../qc/guard";
import { loadOrder } from "../service";
import { listShipments } from "../shipping/service";
import { statusMessage } from "./email";
import { statusEmailSchema } from "./schemas";
import { selectOpsSender } from "./select";
import { sendStatusEmail } from "./service";

const ops = opsContext;

/**
 * Tells a customer where their order is (F-O4). The words are written from the order, never typed, so no
 * message can promise a date. Without an email provider nothing is sent: the record says so and the words are
 * handed back for ops to send themselves.
 */
export const sendStatusEmailAction = defineAction({
  auth: "user",
  rateLimit: LIMITS.manageLeads,
  schema: statusEmailSchema,
  handler: async ({ input, session }) => {
    const { admin, actor } = await ops(session.userId);
    const client = await sessionClient();
    const { order, events } = await loadOrder(client, input.orderId);
    const [brandName, shipments] = await Promise.all([brandNameOf(adminClient(), order.brandId), listShipments(client, order.id)]);
    const parcel = shipments.at(-1);
    const delay = [...events].reverse().find((e) => e.kind === "delayed");
    const message = statusMessage({
      kind: input.kind,
      orderRef: order.externalRef,
      brandName,
      status: order.status,
      ...(parcel ? { parcel: { courier: parcel.courier, trackingNumber: parcel.trackingNumber, trackingUrl: parcel.trackingUrl } } : {}),
      ...(delay?.promisedOn ? { delay: { promisedOn: delay.promisedOn, reason: delay.note } } : {}),
    });
    const out = await sendStatusEmail(admin, actor, { orderId: input.orderId, kind: input.kind, toEmail: input.toEmail, message }, selectOpsSender());
    revalidatePath(`/ops/orders/${input.orderId}`);
    return { sent: out.sent, reason: out.reason, subject: message.subject, body: message.body };
  },
});
