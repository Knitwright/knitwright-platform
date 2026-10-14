import { z } from "zod";
import { getEnv } from "@/lib/config/env";
import { patternLibraryOpenTo } from "@/lib/patterns/access";
import { reviewInputSchema } from "@/lib/pattern-library/review";
import { recordReview } from "@/lib/pattern-library/service";
import { AppError } from "@/lib/server/core/errors";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/** Records a named person's review of one block version. Reviews are never changed or removed. */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.patternLibrary,
  schema: { params: z.object({ blockId: z.uuid() }), body: reviewInputSchema },
  handler: async ({ input, session }) => {
    if (!patternLibraryOpenTo(getEnv(), session.email)) throw new AppError("unavailable", "The pattern library is not open yet.");
    const id = await recordReview(adminClient(), { brandId: session.brand.id, userId: session.userId, blockId: input.params.blockId }, input.body);
    return { id };
  },
});
