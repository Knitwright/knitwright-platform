import { z } from "zod";
import { printFilesBodySchema } from "@/lib/print/server/schemas";
import { printDeps } from "@/lib/print/server/deps";
import { servePrintFiles } from "@/lib/print/server/serve";
import { getProjectAt } from "@/lib/projects/project-reads";
import { defineRoute } from "@/lib/server/define-route";
import { sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/** A zip of print files takes a few seconds to draw. No handler may rely on more than 60 seconds (decision 0002). */
export const maxDuration = 60;

const params = z.object({ projectId: z.uuid() });
/** The query as the route wrapper reads it. It is checked in full by the download itself. */
const rawQuery = z.record(z.string(), z.string());

/**
 * The print files of a design as one zip: a file for every piece of every size asked for, a manifest and a note. It is
 * drawn in memory when it is asked for and sent once; nothing is stored, and no SVG is ever stored. A design of another
 * brand is not found. All the work is in `servePrintFiles`.
 */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.printFiles,
  schema: { params, query: rawQuery },
  handler: async ({ input, session }) => {
    const client = await sessionClient();
    const deps = printDeps({
      client,
      brandId: session.brand.id,
      load: (options) => getProjectAt(client, session.brand.id, input.params.projectId, options.version),
    });
    return servePrintFiles(deps, { query: input.query });
  },
});

/** The same, with a roster in the body: one set of files for each player, and a transfer set when the marks are transfers. */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.printFiles,
  maxBodyBytes: 600_000,
  schema: { params, query: rawQuery, body: printFilesBodySchema },
  handler: async ({ input, session }) => {
    const client = await sessionClient();
    const deps = printDeps({
      client,
      brandId: session.brand.id,
      load: (options) => getProjectAt(client, session.brand.id, input.params.projectId, options.version),
    });
    return servePrintFiles(deps, { query: input.query, roster: input.body });
  },
});
