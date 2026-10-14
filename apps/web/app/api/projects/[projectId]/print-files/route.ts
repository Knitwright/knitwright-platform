import { z } from "zod";
import { DEFAULT_PRINT_RULES, loadPrintProfile } from "@/lib/print/profiles";
import { printQuerySchema, servePrintFiles } from "@/lib/print/service";
import { getProject } from "@/lib/projects/service";
import { defineRoute } from "@/lib/server/define-route";
import { sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { createFileReader } from "@/lib/storage/read";

/** No handler may rely on more than 60 seconds (decision 0002). */
export const maxDuration = 60;

const ICC_MAX_BYTES = 8 * 1024 * 1024;

/**
 * The print files of a design: one file per piece per size, as one zip, built when asked and not stored.
 * A design of another brand is not found. The ICC profile, if the brand has one, is read with the member's own client.
 */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.printFiles,
  schema: { params: z.object({ projectId: z.uuid() }), query: printQuerySchema },
  handler: async ({ input, session }) => {
    const client = await sessionClient();
    const brandId = session.brand.id;
    const project = await getProject(client, brandId, input.params.projectId);
    const profile = await loadPrintProfile(client, brandId);
    const stored = profile.iccFileId ? await createFileReader(client, brandId).read(profile.iccFileId, ICC_MAX_BYTES) : null;
    const icc = stored && stored !== "too-large" ? stored.bytes : null;
    const { source, ...rules } = DEFAULT_PRINT_RULES;
    void source;
    return servePrintFiles({ project: { name: project.name, version: project.currentVersion, spec: project.spec }, profile, rules, icc }, input.query);
  },
});
