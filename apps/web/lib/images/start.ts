import type { ImageMap } from "@/lib/flat/images";
import type { GarmentSpec } from "@/lib/garment";
import { buildImagePrompt, type ImageProvider } from "@/lib/providers";
import type { ChartSet } from "@/lib/sizing";
import { AppError } from "@/lib/server/core/errors";
import { flatModels, renderReference } from "./reference";
import { runImageJob, type RunJobDeps } from "./run-job";

/**
 * Starts photoreal images for a design, when the user asks. Plan step 14, tasks 3 and 4.
 * The cost is already reserved by the route. Everything that can fail quickly (no
 * provider, no drawing) fails here, before a job exists, so the route's own refund covers
 * it. The slow part is handed to `schedule`, which is `after()` in the app.
 */

export const NOT_SET_UP_MESSAGE = "Photoreal images are not set up yet. Nothing was charged.";
export const NO_DRAWING_MESSAGE = "There is no drawing of this garment to make images from yet.";

export interface StartDeps extends Omit<RunJobDeps, "provider"> {
  readonly provider: ImageProvider | null;
  /** Refuses (an AppError) when the brand's storage is already full, before anything is made. */
  readonly ensureStorage: () => Promise<void>;
  /** The design as it is now, its version, and the brand's size charts it is drawn with. */
  readonly loadDesign: () => Promise<Readonly<{ spec: GarmentSpec; version: number; charts: ChartSet }>>;
  /** The pictures its artwork uses, from the uploaded files. */
  readonly loadPictures: (spec: GarmentSpec) => Promise<ImageMap>;
  /** Records a queued job for the version and returns its id. */
  readonly createJob: (version: number) => Promise<string>;
  readonly schedule: (work: () => Promise<unknown>) => void;
}

type StartInput = Readonly<{ eventId: string; colourwayId?: string }>;

export async function startImageJob(deps: StartDeps, input: StartInput): Promise<{ jobId: string }> {
  const provider = deps.provider;
  if (!provider) throw new AppError("unavailable", NOT_SET_UP_MESSAGE);
  await deps.ensureStorage();

  const { spec, version, charts } = await deps.loadDesign();
  const models = flatModels(spec, charts, input.colourwayId);
  if (!models) throw new AppError("invalid_input", NO_DRAWING_MESSAGE);

  const pictures = await deps.loadPictures(spec);
  const [front, back] = await Promise.all([
    renderReference(models.front, pictures),
    renderReference(models.back, pictures),
  ]);
  const requests = {
    front: { prompt: buildImagePrompt(spec, "front", input.colourwayId), reference: front },
    back: { prompt: buildImagePrompt(spec, "back", input.colourwayId), reference: back },
  };

  const jobId = await deps.createJob(version);
  deps.schedule(() => runImageJob({ ...deps, provider }, { jobId, eventId: input.eventId, requests }));
  return { jobId };
}
