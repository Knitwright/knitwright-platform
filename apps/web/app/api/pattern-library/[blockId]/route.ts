import { z } from "zod";
import { getEnv } from "@/lib/config/env";
import { patternLibraryOpenTo } from "@/lib/patterns/access";
import { getBlock } from "@/lib/pattern-library/service";
import { AppError } from "@/lib/server/core/errors";
import { defineRoute } from "@/lib/server/define-route";
import { sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/** One block with its sizes, the points measured from each, the checks that ran and every review. */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: { params: z.object({ blockId: z.uuid() }) },
  handler: async ({ input, session }) => {
    if (!patternLibraryOpenTo(getEnv(), session.email)) throw new AppError("unavailable", "The pattern library is not open yet.");
    const detail = await getBlock(await sessionClient(), session.brand.id, input.params.blockId);
    if (!detail) throw new AppError("not_found", "That pattern does not exist.");
    return detail;
  },
});
