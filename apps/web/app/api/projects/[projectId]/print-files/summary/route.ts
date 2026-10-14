import { z } from "zod";
import { printDeps } from "@/lib/print/server/deps";
import { printSummary } from "@/lib/print/server/summary";
import { getProjectAt } from "@/lib/projects/project-reads";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/**
 * What the print panel shows before anything is made: the pattern, the settings the files would use, and where the zones
 * are on each piece. It makes no file.
 */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: { params: z.object({ projectId: z.uuid() }), query: z.record(z.string(), z.string()) },
  handler: async ({ input, session }) => {
    const client = await sessionClient();
    const deps = printDeps({
      client,
      admin: adminClient(),
      brandId: session.brand.id,
      load: (options) => getProjectAt(client, session.brand.id, input.params.projectId, options.version),
    });
    return printSummary(deps, { query: input.query });
  },
});
