import { z } from "zod";
import { loadPrintDeps } from "@/lib/print/inputs/deps";
import { printQuerySchema, servePrintFiles } from "@/lib/print/service";
import { withCredits, versionOf } from "@/lib/credits-gate/server";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/** No handler may rely on more than 60 seconds (decision 0002). */
export const maxDuration = 60;

/**
 * The print files of a design: one file per piece per size, as one zip, built when asked and not stored, from the design's
 * own artwork, the pattern library's pattern and, when one is named, a team list. A design, pattern or team list of another
 * brand is not found. Artwork is read only through the brand's artwork reader; no stored original is opened.
 */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.printFiles,
  schema: { params: z.object({ projectId: z.uuid() }), query: printQuerySchema },
  handler: withCredits(
    {
      kind: "pattern_file",
      version: ({ input, session }) => versionOf(session.brand.id, input.params.projectId),
      where: "GET /api/projects/[projectId]/print-files",
    },
    async ({ input, session }) =>
      servePrintFiles(
        await loadPrintDeps({ client: await sessionClient(), admin: adminClient() }, { brandId: session.brand.id, email: session.email }, input.params.projectId, input.query),
        input.query,
      ),
  ),
});
