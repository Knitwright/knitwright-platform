import { importTemplate } from "@/lib/channels/csv";
import { defineRoute } from "@/lib/server/define-route";
import { LIMITS } from "@/lib/server/limits";

/** The orders CSV a brand fills in to import (decision 0155). Any member; it holds no data. */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.channelExport,
  schema: {},
  handler: async () =>
    new Response(importTemplate("KW-00000000000000000000000000000000-M"), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="knitwright-orders-template.csv"', "cache-control": "no-store" },
    }),
});
