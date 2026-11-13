import { ordersCsv } from "@/lib/channels/exports";
import { defineRoute } from "@/lib/server/define-route";
import { sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/** The brand's channel orders as CSV, newest first, without buyers' addresses (decision 0155). Any member. */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.channelExport,
  schema: {},
  handler: async ({ session }) =>
    new Response(await ordersCsv(await sessionClient(), session.brand.id), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="knitwright-channel-orders.csv"', "cache-control": "no-store" },
    }),
});
