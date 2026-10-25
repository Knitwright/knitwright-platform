import { z } from "zod";
import { mediaFiles, mediaStore } from "@/lib/media/service";
import { MAX_POSTER_BYTES, MAX_TURNTABLE_BYTES } from "@/lib/media/video/limits";
import { videoFiles } from "@/lib/media/video/files";
import { saveTurntable } from "@/lib/media/video/turntable";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { ensureStorageRoom } from "@/lib/storage/store";

/** Room for the form's own text around the two files. */
const FORM_OVERHEAD_BYTES = 64 * 1024;

/**
 * Takes in a turntable recorded in the browser: the video and a still frame from it. Free (nothing paid is called). A second
 * recording replaces the first. The still is watermarked; the video is the brand's own recording, so members get it as it is.
 */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.startImages,
  maxBodyBytes: MAX_TURNTABLE_BYTES + MAX_POSTER_BYTES + FORM_OVERHEAD_BYTES,
  schema: {
    params: z.object({ projectId: z.uuid(), setId: z.uuid() }),
    form: z.object({
      video: z.instanceof(File, { message: "Record a turntable first." }),
      poster: z.instanceof(File, { message: "The recording needs a still picture." }),
    }),
  },
  handler: async ({ input, session }) => {
    const admin = adminClient();
    const client = await sessionClient();
    const brandId = session.brand.id;
    const video = new Uint8Array(await input.form.video.arrayBuffer());
    await ensureStorageRoom(admin, brandId, video.byteLength);
    return saveTurntable(
      { store: mediaStore(admin, client), files: mediaFiles(admin, client, { brandId, userId: session.userId }), videos: videoFiles(admin, brandId) },
      { brandId, projectId: input.params.projectId, setId: input.params.setId, video, poster: new Uint8Array(await input.form.poster.arrayBuffer()) },
    );
  },
});
