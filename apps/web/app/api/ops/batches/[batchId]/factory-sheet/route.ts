import { z } from "zod";
import { assertPlatformAdmin } from "@/lib/ops/access";
import { factorySheetPdf } from "@/lib/ops/factory-sheet/pdf";
import { buildSheet } from "@/lib/ops/factory-sheet/model";
import { loadBatchSources, sheetInputOf } from "@/lib/ops/sheet-data";
import { loadSettings } from "@/lib/ops/service";
import { fileResponse, sheetFileName } from "@/lib/ops/download";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

export const maxDuration = 60;

const params = z.object({ batchId: z.uuid() });

/** The factory sheet of one batch as a PDF. Platform admins only; everyone else gets "not found". */
export const GET = defineRoute({
  auth: "user",
  rateLimit: LIMITS.export,
  schema: { params },
  handler: async ({ input }) => {
    const client = await sessionClient();
    await assertPlatformAdmin(client);
    const { batch, sources } = await loadBatchSources(adminClient(), input.params.batchId);
    const pdf = await factorySheetPdf(buildSheet(sheetInputOf(batch, sources, await loadSettings(client))));
    return fileResponse(pdf, "application/pdf", sheetFileName(batch, "factory-sheet.pdf"));
  },
});
