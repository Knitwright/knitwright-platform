import { z } from "zod";
import { rosterContextOf } from "@/lib/orders/context";
import { orderBody } from "@/lib/orders/schemas";
import { listTeamOrders } from "@/lib/orders/service";
import { saveOrder } from "@/lib/orders/use-cases";
import { getProject } from "@/lib/projects/service";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

const params = z.object({ projectId: z.uuid() });

/** The design's team orders, and what a team list is checked against: the sizes made and whether a name is printed. */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: { params },
  handler: async ({ input, session }) => {
    const client = await sessionClient();
    const [orders, project] = await Promise.all([
      listTeamOrders(client, session.brand.id, input.params.projectId),
      getProject(client, session.brand.id, input.params.projectId),
    ]);
    return { orders, context: rosterContextOf(project.spec) };
  },
});

/** Makes a team order. Problems in the list are returned with it, not refused. */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.rosterImport,
  maxBodyBytes: 400_000,
  schema: { params, body: orderBody },
  handler: async ({ input, session }) =>
    saveOrder({ client: await sessionClient(), admin: adminClient() }, { brandId: session.brand.id, userId: session.userId }, input.params.projectId, null, input.body),
});
