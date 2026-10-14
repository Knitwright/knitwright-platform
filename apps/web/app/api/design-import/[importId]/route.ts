import { payloadOf } from "@/lib/design-import/payload";
import { loadImport, discardImport } from "@/lib/design-import/service";
import { importIdParams } from "@/lib/design-import/schemas";
import { AppError } from "@/lib/server/core/errors";
import { defineRoute } from "@/lib/server/define-route";
import { LIMITS } from "@/lib/server/limits";
import { importStore } from "../deps";

/** One reading, for the side-by-side screen. Only the brand's own. */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: { params: importIdParams },
  handler: async ({ input, session }) => {
    const record = await loadImport(await importStore(), session.brand.id, input.params.importId);
    if (record === null) throw new AppError("not_found", "That reading does not exist.");
    return payloadOf(record);
  },
});

/** Throws a proposal away. Its row stays, so what the reading cost stays on record. */
export const DELETE = defineRoute({
  auth: "member",
  rateLimit: LIMITS.designImportChange,
  schema: { params: importIdParams },
  handler: async ({ input, session }) => discardImport(await importStore(), session.brand.id, input.params.importId),
});
