import { payloadOf } from "@/lib/design-import/payload";
import { importIdParams, refitSchema } from "@/lib/design-import/schemas";
import { refitImport } from "@/lib/design-import/service";
import { starterTemplate } from "@/lib/design-import/template";
import { defineRoute } from "@/lib/server/define-route";
import { LIMITS } from "@/lib/server/limits";
import { importStore, refitEdits } from "../../deps";

/** Redoes the fit of one view after landmarks were dragged. No model is called and nothing is read again. */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.designImportChange,
  maxBodyBytes: 8192,
  schema: { params: importIdParams, body: refitSchema },
  handler: async ({ input, session }) => {
    const result = await refitImport(await importStore(), starterTemplate, session.brand.id, input.params.importId, refitEdits(input.body));
    return result.kind === "refit" ? { kind: "refit" as const, reading: payloadOf(result.record) } : result;
  },
});
