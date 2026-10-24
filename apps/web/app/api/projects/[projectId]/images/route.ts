import { after } from "next/server";
import { z } from "zod";
import { brandChartSet } from "@/lib/charts/service";
import { PHOTOREAL_COST } from "@/lib/images/cost";
import { createJob, imageRemover, imageSaver, jobStore } from "@/lib/images/service";
import { startImageJob } from "@/lib/images/start";
import { loadArtworkImages } from "@/lib/projects/artwork-images";
import { withCredits, versionOf } from "@/lib/credits-gate/server";
import { getProject } from "@/lib/projects/service";
import { defineRoute } from "@/lib/server/define-route";
import { adminClient, imageProvider, productionDeps, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { log } from "@/lib/server/log";
import { createFileReader } from "@/lib/storage/read";
import { ensureStorageRoom } from "@/lib/storage/store";
import { shrinkForDrawing } from "@/lib/storage/thumbnail";

/** The work carried on by after() must fit the platform's limit (decision record 0002). */
export const maxDuration = 60;

/**
 * Starts photoreal images, front and back, of a design. Plan step 14. The cost is reserved
 * from the photoreal allowance before the handler runs; the images are made after the
 * response, and the browser polls the job. A failure gives the cost back.
 */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.startImages,
  schema: {
    params: z.object({ projectId: z.uuid() }),
    body: z.object({ colourway: z.string().max(64).optional() }),
  },
  cost: PHOTOREAL_COST,
  handler: withCredits(
    {
      kind: "marketing_media",
      version: ({ input, session }) => versionOf(session.brand.id, input.params.projectId),
      where: "POST /api/projects/[projectId]/images",
    },
    async ({ input, session, usage }) => {
    if (!usage) throw new Error("A photoreal request must be paid for.");
    const admin = adminClient();
    const client = await sessionClient();
    const brandId = session.brand.id;
    const { projectId } = input.params;

    return startImageJob(
      {
        provider: imageProvider(),
        // Any room at all: the pictures' sizes are known only once they are made, and the
        // database refuses a picture that would pass the quota when it is stored.
        ensureStorage: () => ensureStorageRoom(admin, brandId, 1),
        loadDesign: async () => {
          const [project, charts] = await Promise.all([getProject(client, brandId, projectId), brandChartSet(client, brandId)]);
          return { spec: project.spec, version: project.currentVersion, charts };
        },
        loadPictures: async (spec) =>
          (await loadArtworkImages(createFileReader(client, brandId), shrinkForDrawing, spec)).images,
        createJob: (version) =>
          createJob(admin, { brandId, projectId, version, userId: session.userId, eventId: usage.eventId }),
        schedule: (work) => after(work),
        jobs: jobStore(admin),
        saveImage: imageSaver(admin, brandId, session.userId),
        removeImages: imageRemover(admin, brandId),
        refund: productionDeps.usage.refund,
        log,
      },
      { eventId: usage.eventId, colourwayId: input.body.colourway },
    );
    },
  ),
});
