import { z } from "zod";
import { videoFiles } from "@/lib/media/video/files";
import { CLIP_LOCKED_MESSAGE, serveVideo } from "@/lib/media/video/serve";
import { mediaStore } from "@/lib/media/service";
import { AppError } from "@/lib/server/core/errors";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/**
 * The video of a turntable or clip item. A turntable goes to the brand's members at once; a clip only once the set is unlocked
 * with credits, and before that this answers in words and storage is not asked for the file.
 */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.pollJob,
  schema: { params: z.object({ projectId: z.uuid(), setId: z.uuid(), itemId: z.uuid() }) },
  handler: async ({ input, session }) => {
    const admin = adminClient();
    const served = await serveVideo({ store: mediaStore(admin, await sessionClient()), videos: videoFiles(admin, session.brand.id) }, { brandId: session.brand.id, ...input.params });
    if (served.state === "locked") throw new AppError("conflict", CLIP_LOCKED_MESSAGE);
    if (served.state === "missing") throw new AppError("not_found", "That video could not be found.");
    return new Response(Buffer.from(served.bytes), {
      headers: {
        "content-type": served.contentType,
        "cache-control": "private, no-store",
        "x-media-ai-generated": String(served.aiGenerated),
        "content-disposition": `inline; filename="knitwright-${input.params.itemId}.${served.contentType === "video/mp4" ? "mp4" : "webm"}"`,
      },
    });
  },
});
