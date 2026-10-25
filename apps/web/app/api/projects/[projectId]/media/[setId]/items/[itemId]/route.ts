import { z } from "zod";
import { mediaFiles, mediaStore } from "@/lib/media/service";
import { serveItem } from "@/lib/media/serve";
import { AppError } from "@/lib/server/core/errors";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/**
 * One picture of a media set. The server chooses what to send: the watermarked picture until the set is unlocked,
 * the clean one after. The browser is never given a path or an address to the clean file.
 */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.pollJob,
  schema: { params: z.object({ projectId: z.uuid(), setId: z.uuid(), itemId: z.uuid() }) },
  handler: async ({ input, session }) => {
    const admin = adminClient();
    const client = await sessionClient();
    const served = await serveItem(
      { store: mediaStore(admin, client), files: mediaFiles(admin, client, { brandId: session.brand.id, userId: session.userId }) },
      { brandId: session.brand.id, ...input.params },
    );
    if (!served) throw new AppError("not_found", "That picture could not be found.");
    return new Response(Buffer.from(served.bytes), {
      headers: {
        "content-type": served.contentType,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "x-media-watermarked": String(served.watermarked),
        "content-disposition": `inline; filename="knitwright-${input.params.itemId}${served.watermarked ? "-preview" : ""}.png"`,
      },
    });
  },
});
