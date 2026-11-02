import { refitImport } from "@/lib/design-import/create";
import { createDerivedStore } from "@/lib/design-import/derived";
import { importIdParams, refitSchema } from "@/lib/design-import/schemas";
import { uploadGate } from "@/lib/moderation/server";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { log } from "@/lib/server/log";
import { createFileReader } from "@/lib/storage/read";
import { TIMEOUT_MS, pipelineFor, requireEnabled } from "../../runtime";

/** Redoes the fit after the person dragged landmarks. It uses the reading already made, so it makes no vision call. */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.editDesign,
  maxBodyBytes: 8192,
  schema: { params: importIdParams, body: refitSchema },
  handler: async ({ input, session }) => {
    requireEnabled();
    const client = await sessionClient();
    return refitImport(
      {
        client,
        admin: adminClient(),
        who: { brandId: session.brand.id, userId: session.userId },
        pipeline: pipelineFor(null, false),
        readFile: (id, maxBytes) => createFileReader(client, session.brand.id).read(id, maxBytes),
        store: (now) => createDerivedStore(adminClient(), { brandId: session.brand.id, userId: session.userId }, now, uploadGate("POST /api/design-import/[importId]/refit")),
        log,
        timeoutMs: TIMEOUT_MS,
      },
      input.params.importId,
      input.body.edits,
    );
  },
});
