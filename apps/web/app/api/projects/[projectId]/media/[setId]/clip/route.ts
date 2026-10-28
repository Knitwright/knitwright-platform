import { after } from "next/server";
import { z } from "zod";
import { getEnv } from "@/lib/config/env";
import { withCredits } from "@/lib/credits-gate/server";
import { mediaFiles, mediaStore } from "@/lib/media/service";
import { startClip } from "@/lib/media/video/start-clip";
import { MAX_CLIP_BYTES } from "@/lib/media/video/limits";
import { CLIP_COST } from "@/lib/media/video/cost";
import { videoFiles } from "@/lib/media/video/files";
import { chooseVideoProvider } from "@/lib/media/video/select";
import { AppError } from "@/lib/server/core/errors";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { log } from "@/lib/server/log";
import { ensureStorageRoom } from "@/lib/storage/store";

/** The work carried on by after() must fit the platform's limit (decision record 0002). */
export const maxDuration = 60;

/**
 * Starts the five second clip of a set, from a lifestyle picture that passed the check. A paid, AI call: its estimated cost is
 * reserved from the photoreal allowance first (and given back if nothing is made), and the credits gate runs as for the set.
 * The clip file is served only after the set is unlocked. The provider is the stub unless the owner has switched video on.
 */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.startImages,
  schema: {
    params: z.object({ projectId: z.uuid(), setId: z.uuid() }),
    body: z.object({ view: z.enum(["on_model", "scene"]).optional() }),
  },
  cost: CLIP_COST,
  handler: withCredits(
    {
      kind: "marketing_media",
      version: async ({ input, session }) => {
        const set = await mediaStore(adminClient(), await sessionClient()).read(session.brand.id, input.params.projectId, input.params.setId);
        if (!set) throw new AppError("not_found", "That media set could not be found.");
        return { projectId: set.projectId, version: set.version };
      },
      where: "POST /api/projects/[projectId]/media/[setId]/clip",
    },
    async ({ input, session, usage }) => {
      const admin = adminClient();
      const client = await sessionClient();
      const brandId = session.brand.id;
      const env = getEnv();
      await ensureStorageRoom(admin, brandId, MAX_CLIP_BYTES);
      return startClip(
        {
          store: mediaStore(admin, client),
          files: mediaFiles(admin, client, { brandId, userId: session.userId }),
          videos: videoFiles(admin, brandId),
          provider: chooseVideoProvider({ FAL_KEY: env.FAL_KEY, MEDIA_VIDEO_LIVE: env.MEDIA_VIDEO_LIVE }),
          log,
          schedule: (work) => after(work),
          refund: async () => usage?.refund(),
        },
        { brandId, projectId: input.params.projectId, setId: input.params.setId, view: input.body.view },
      );
    },
  ),
});
