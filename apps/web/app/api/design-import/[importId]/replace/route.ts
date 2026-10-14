import { createAssetReader } from "@/lib/artwork-intake";
import { importIdParams, replaceSchema } from "@/lib/design-import/schemas";
import { getImport, replaceGraphic } from "@/lib/design-import/service";
import { analysisView } from "@/lib/design-import/view-model";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { requireEnabled } from "../../runtime";

/**
 * One click to replace a crest, sponsor or badge redrawn from the picture with the person's own file. The file goes in
 * through the artwork upload (W7b: the rights box, the print and screen copies); this only points the layer at it.
 */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.editDesign,
  maxBodyBytes: 2048,
  schema: { params: importIdParams, body: replaceSchema },
  handler: async ({ input, session }) => {
    requireEnabled();
    const admin = adminClient();
    const who = { brandId: session.brand.id, userId: session.userId };
    await replaceGraphic(admin, who, input.params.importId, input.body.layerId, input.body.artworkId, createAssetReader(admin, who.brandId));
    return { kind: "ready" as const, view: analysisView(await getImport(await sessionClient(), who.brandId, input.params.importId)) };
  },
});
