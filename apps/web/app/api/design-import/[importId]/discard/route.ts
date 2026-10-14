import { importIdParams } from "@/lib/design-import/schemas";
import { discardImport } from "@/lib/design-import/service";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { requireEnabled } from "../../runtime";

/** Throws a reading away. Nothing was ever kept as the design. */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.editDesign,
  schema: { params: importIdParams },
  handler: async ({ input, session }) => {
    requireEnabled();
    await discardImport(adminClient(), { brandId: session.brand.id, userId: session.userId }, input.params.importId);
    return { discarded: true };
  },
});
