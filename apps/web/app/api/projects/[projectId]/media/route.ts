import { after } from "next/server";
import { z } from "zod";
import { getEnv } from "@/lib/config/env";
import { lifestyleEnv } from "@/lib/media/lifestyle/env";
import { loadStudioDesign } from "@/lib/media/design";
import { runMediaSet } from "@/lib/media/generate";
import { lifestyleGenerators } from "@/lib/media/lifestyle/register";
import { mediaFiles, mediaStore } from "@/lib/media/service";
import { startMediaSet } from "@/lib/media/start";
import { studioGenerator } from "@/lib/media/studio-generator";
import { MEDIA_SET_RESERVE_BYTES } from "@/lib/media/video/limits";
import { setView } from "@/lib/media/view";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, productionDeps, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { log } from "@/lib/server/log";
import { ensureStorageRoom } from "@/lib/storage/store";

/** The work carried on by after() must fit the platform's limit (decision record 0002). */
export const maxDuration = 60;

/**
 * Starts the media set of the design's current version: studio renders (front, back, flat lay). Free to make; the
 * pictures are watermarked until the set is unlocked with credits. The same version gives the set that exists.
 */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.startImages,
  schema: { params: z.object({ projectId: z.uuid() }), body: z.object({}) },
  handler: async ({ input, session }) => {
    const admin = adminClient();
    const client = await sessionClient();
    const { brandId } = { brandId: session.brand.id };
    const { projectId } = input.params;
    const store = mediaStore(admin, client);
    const files = mediaFiles(admin, client, { brandId, userId: session.userId });
    const loadDesign = async (design: { version: number }) => loadStudioDesign(client, brandId, projectId, design.version);
    // Lifestyle pictures are made only when the owner has chosen a provider (decision 0057); by default this adds nothing.
    const generators = [
      studioGenerator(loadDesign),
      ...lifestyleGenerators({ env: lifestyleEnv(getEnv()), usage: productionDeps.usage, client, brandId, userId: session.userId, loadDesign, log }),
    ];

    await ensureStorageRoom(admin, brandId, MEDIA_SET_RESERVE_BYTES);
    const { set, created } = await startMediaSet(
      {
        store,
        loadVersion: async (asked) => {
          const design = await loadStudioDesign(client, brandId, projectId, asked);
          return design ? { version: design.version } : null;
        },
        schedule: (work) => after(work),
        run: (work) => runMediaSet({ store, files, generators, log }, { ...work, brandId }),
      },
      { brandId, projectId, userId: session.userId },
    );
    return { created, set: setView(set) };
  },
});

/** The newest media set of the design, or null when none has been made. */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.pollJob,
  schema: { params: z.object({ projectId: z.uuid() }) },
  handler: async ({ input, session }) => {
    const set = await mediaStore(adminClient(), await sessionClient()).latest(session.brand.id, input.params.projectId);
    return { set: set ? setView(set) : null };
  },
});
