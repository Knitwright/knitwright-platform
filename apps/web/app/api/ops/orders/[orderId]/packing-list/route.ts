import { z } from "zod";
import { assertPlatformAdmin } from "@/lib/ops/access";
import { fileResponse } from "@/lib/ops/download";
import { buildPackingList } from "@/lib/ops/packing/model";
import { packingListPdf } from "@/lib/ops/packing/pdf";
import { loadPackingSource } from "@/lib/ops/packing/service";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

export const maxDuration = 60;

const params = z.object({ orderId: z.uuid() });

const safe = (text: string): string => text.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 60) || "order";

/** The packing list of one order as a PDF. Platform admins only; everyone else gets "not found". */
export const GET = defineRoute({
  auth: "user",
  rateLimit: LIMITS.export,
  schema: { params },
  handler: async ({ input }) => {
    const client = await sessionClient();
    await assertPlatformAdmin(client);
    const { order, bags, cartons, team, brandName } = await loadPackingSource(client, adminClient(), input.params.orderId);
    const pdf = await packingListPdf(buildPackingList({ order, brandName, bags, cartons, roster: team.roster }));
    return fileResponse(pdf, "application/pdf", `${safe(order.externalRef)}-packing-list.pdf`);
  },
});
