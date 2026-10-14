import { acceptSchema, importIdParams } from "@/lib/design-import/schemas";
import { acceptImport } from "@/lib/design-import/service";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { requireEnabled } from "../../runtime";

/**
 * Accepts all the layers of a reading, or the ones chosen. Only now is a stack kept as the person's. Layers redrawn from
 * the picture (crests, sponsors) are named, because they need the person's own file.
 */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.editDesign,
  maxBodyBytes: 4096,
  schema: { params: importIdParams, body: acceptSchema },
  handler: async ({ input, session }) => {
    requireEnabled();
    const { stack, needsOwnFile } = await acceptImport(adminClient(), { brandId: session.brand.id, userId: session.userId }, input.params.importId, input.body.layerIds);
    return { accepted: true, layerIds: stack.layers.map((layer) => layer.id), needsOwnFile };
  },
});
