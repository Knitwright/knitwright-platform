import { productsCsv } from "@/lib/channels/exports";
import { defineRoute } from "@/lib/server/define-route";
import { sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/** The brand's products as CSV, one row per product and size with its SKU (decision 0155). Any member. */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.channelExport,
  schema: {},
  handler: async ({ session }) => csvResponse("knitwright-products.csv", await productsCsv(await sessionClient(), session.brand.id)),
});

const csvResponse = (name: string, body: string) =>
  new Response(body, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}"`, "cache-control": "no-store" } });
