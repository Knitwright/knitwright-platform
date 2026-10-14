import { analysisView } from "@/lib/design-import/view-model";
import { importIdParams } from "@/lib/design-import/schemas";
import { getImport } from "@/lib/design-import/service";
import { defineRoute } from "@/lib/server/define-route";
import { sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { requireEnabled } from "../runtime";

/** One import: the proposal, its report and the overlay for the side-by-side screen. */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: { params: importIdParams },
  handler: async ({ input, session }) => {
    requireEnabled();
    return analysisView(await getImport(await sessionClient(), session.brand.id, input.params.importId));
  },
});
