import { z } from "zod";
import { orderBody } from "@/lib/orders/schemas";
import { deleteTeamOrder } from "@/lib/orders/service";
import { openOrder, saveOrder } from "@/lib/orders/use-cases";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

const params = z.object({ projectId: z.uuid(), orderId: z.uuid() });

export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: { params },
  handler: async ({ input, session }) => openOrder(await sessionClient(), session.brand.id, input.params.projectId, input.params.orderId),
});

/** Replaces the name and every row of the team order. */
export const PUT = defineRoute({
  auth: "member",
  rateLimit: LIMITS.rosterImport,
  maxBodyBytes: 400_000,
  schema: { params, body: orderBody },
  handler: async ({ input, session }) =>
    saveOrder({ client: await sessionClient(), admin: adminClient() }, { brandId: session.brand.id, userId: session.userId }, input.params.projectId, input.params.orderId, input.body),
});

/** Erases the team order and every name in it. A release keeps only a hash of the list, so no name stays behind. */
export const DELETE = defineRoute({
  auth: "member",
  rateLimit: LIMITS.rosterImport,
  schema: { params },
  handler: async ({ input, session }) => {
    await deleteTeamOrder(adminClient(), session.brand.id, input.params.projectId, input.params.orderId);
    return { deleted: true as const };
  },
});
