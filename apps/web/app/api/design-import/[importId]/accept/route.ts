import { acceptSchema, importIdParams } from "@/lib/design-import/schemas";
import { acceptImport } from "@/lib/design-import/service";
import { defineRoute } from "@/lib/server/define-route";
import { LIMITS } from "@/lib/server/limits";
import { importStore } from "../../deps";

/**
 * Records that a person accepted a reading, all of it or some layers, and hands back the accepted stack. This is the
 * only step that treats a reading as the person's choice. It does not write a design version.
 */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.designImportChange,
  maxBodyBytes: 8192,
  schema: { params: importIdParams, body: acceptSchema },
  handler: async ({ input, session }) =>
    acceptImport(await importStore(), { brandId: session.brand.id, userId: session.userId }, input.params.importId, input.body.layerIds),
});
