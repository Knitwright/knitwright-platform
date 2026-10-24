import { z } from "zod";
import { readPage } from "@/lib/pagination/pages";
import { filtersFromQuery, listTemplates } from "@/lib/templates/filters";
import { loadLibrary } from "@/lib/templates/service";
import { defineRoute } from "@/lib/server/define-route";
import { sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

const query = z.record(z.string(), z.union([z.string(), z.array(z.string())]));

/** One page of the template library, filtered by `sport`, `article`, `style` and `colour`. Platform data: the same for every brand. */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: { query },
  handler: async ({ input }) => {
    const found = listTemplates(await loadLibrary(await sessionClient()), filtersFromQuery(input.query), readPage(input.query.page));
    return { templates: found.rows, total: found.total, totalPages: found.totalPages, page: found.page };
  },
});
