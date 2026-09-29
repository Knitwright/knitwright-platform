import { recordDownload } from "@/lib/projects/export-record";
import { serveExport } from "@/lib/projects/export-download";
import { loadTechPackSource } from "@/lib/projects/tech-pack-load";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { PRINT_MAX_EMBEDDED_BYTES } from "@/lib/techpack/exports/limits";
import { shrinkForPrint } from "@/lib/techpack/exports/print-images";
import { exportParamsSchema, rawQuerySchema } from "@/lib/techpack/exports/request";

/** No handler may rely on more than 60 seconds (decision 0002). An export takes a second or two. */
export const maxDuration = 60;

/**
 * One tech pack as a PDF, an Excel file or an SVG drawing. It is built in memory when it is asked
 * for, the download is recorded, and the file is sent once. Nothing is stored. A design of another
 * brand is not found. All the work is in `serveExport`.
 */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.export,
  schema: { params: exportParamsSchema, query: rawQuerySchema },
  handler: async ({ input, session }) => {
    const client = await sessionClient();
    const { projectId, format } = input.params;
    return serveExport(
      {
        brandName: session.brand.name,
        now: () => new Date(),
        load: (options) =>
          loadTechPackSource(client, session.brand.id, projectId, {
            ...options,
            shrink: shrinkForPrint,
            maxEmbeddedBytes: PRINT_MAX_EMBEDDED_BYTES,
          }),
        record: (entry) => recordDownload(adminClient(), session.userId, entry),
      },
      { projectId, format, query: input.query },
    );
  },
});
