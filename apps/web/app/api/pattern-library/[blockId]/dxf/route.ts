import { z } from "zod";
import { getEnv } from "@/lib/config/env";
import { patternLibraryOpenTo } from "@/lib/patterns/access";
import { blockDxf } from "@/lib/pattern-library/service";
import { AppError } from "@/lib/server/core/errors";
import { defineRoute } from "@/lib/server/define-route";
import { sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/**
 * A DXF of one size, or of every size, built now so it carries the block's present review line:
 * "Draft pattern, not reviewed." until a named person has reviewed it.
 */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.export,
  schema: {
    params: z.object({ blockId: z.uuid() }),
    query: z.object({ size: z.string().trim().min(1).max(16).default("all") }),
  },
  handler: async ({ input, session }) => {
    if (!patternLibraryOpenTo(getEnv(), session.email)) throw new AppError("unavailable", "The pattern library is not open yet.");
    const file = await blockDxf(await sessionClient(), session.brand.id, input.params.blockId, input.query.size);
    if (!file) throw new AppError("not_found", "That pattern or size does not exist.");
    return new Response(file.text, {
      headers: {
        "content-type": "application/dxf",
        "content-disposition": `attachment; filename="${file.name}"`,
        "cache-control": "no-store",
      },
    });
  },
});
