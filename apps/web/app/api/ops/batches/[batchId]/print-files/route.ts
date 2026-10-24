import { z } from "zod";
import { assertPlatformAdmin } from "@/lib/ops/access";
import { printZip } from "@/lib/ops/factory-sheet/print-zip";
import { fileResponse, sheetFileName } from "@/lib/ops/download";
import { loadBatchSources, releaseFilesOf } from "@/lib/ops/sheet-data";
import { printFileBuilder } from "@/lib/releases/builder";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

export const maxDuration = 60;

const params = z.object({ batchId: z.uuid() });

/**
 * The print files of every order in a batch as one zip. The files are built again from each release's frozen
 * settings; the manifest says which differ from the hash frozen with the release. Platform admins only.
 */
export const GET = defineRoute({
  auth: "user",
  rateLimit: LIMITS.export,
  schema: { params },
  handler: async ({ input }) => {
    await assertPlatformAdmin(await sessionClient());
    const admin = adminClient();
    const { batch, sources } = await loadBatchSources(admin, input.params.batchId);
    const zip = await printZip(releaseFilesOf(sources, (brandId) => printFileBuilder({ client: admin, admin }, brandId)));
    return fileResponse(zip, "application/zip", sheetFileName(batch, "print-files.zip"));
  },
});
