import { createFromFile } from "@/lib/design-import/create";
import { visionCost } from "@/lib/design-import/cost";
import { createImportSchema } from "@/lib/design-import/schemas";
import { listImports } from "@/lib/design-import/service";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { log } from "@/lib/server/log";
import { createFileReader } from "@/lib/storage/read";
import { TIMEOUT_MS, pipelineFor, requireEnabled, visionModel } from "./runtime";

// A reading may make a vision call, a retry and an image edit, each under the model timeout.
export const maxDuration = 60;

/** The brand's design imports, newest first. */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: {},
  handler: async ({ session }) => {
    requireEnabled();
    return { imports: await listImports(await sessionClient(), session.brand.id) };
  },
});

/**
 * Reads a picture the person uploaded through /api/files into a proposed design. The person must say they have the
 * right to use it. The answer is a close reading to look at beside the picture; nothing is saved as the design until
 * it is accepted. Priced at the most a first reading can use, reserved before it runs.
 */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.designImport,
  maxBodyBytes: 2048,
  schema: { body: createImportSchema },
  cost: () => {
    const vision = visionModel();
    return vision ? visionCost(vision.entry) : null;
  },
  handler: async ({ input, session, usage }) => {
    requireEnabled();
    const client = await sessionClient();
    const vision = visionModel();
    return createFromFile(
      {
        client,
        admin: adminClient(),
        who: { brandId: session.brand.id, userId: session.userId },
        vision,
        usage,
        pipeline: pipelineFor(vision),
        readFile: (id, maxBytes) => createFileReader(client, session.brand.id).read(id, maxBytes),
        log,
        timeoutMs: TIMEOUT_MS,
      },
      { fileId: input.body.fileId },
    );
  },
});
