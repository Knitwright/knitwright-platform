import { getEnv } from "@/lib/config/env";
import { patternLibraryOpenTo } from "@/lib/patterns/access";
import { programmeFieldsSchema, uploadProgramme } from "@/lib/pattern-library/upload";
import { AppError } from "@/lib/server/core/errors";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/** Stores a knit programme (socks): the factory's size map and a note on its file. Never pieces. */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.patternLibrary,
  schema: { body: programmeFieldsSchema },
  handler: async ({ input, session }) => {
    if (!patternLibraryOpenTo(getEnv(), session.email)) throw new AppError("unavailable", "The pattern library is not open yet.");
    return uploadProgramme(adminClient(), { brandId: session.brand.id, userId: session.userId }, input.body);
  },
});
