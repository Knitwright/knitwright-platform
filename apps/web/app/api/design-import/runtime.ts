import "server-only";
import { getEnv } from "@/lib/config/env";
import { buildPipelineDeps } from "@/lib/design-import/deps";
import { pickVisionModel } from "@/lib/design-import/deps";
import { DESIGN_IMPORT_OFF, designImportEnabled } from "@/lib/design-import/switch";
import { createFalProvider } from "@/lib/providers/fal";
import { MODEL_TIMEOUT_MS, assistantModels } from "@/lib/projects/assistant";
import type { PricedProvider } from "@/lib/providers/select";
import { AppError } from "@/lib/server/core/errors";
import type { RouteUsage } from "@/lib/server/core/metered";

/** The running server's view of design import: the switch, the vision model and the image model. Shared by the routes. */

export const TIMEOUT_MS = MODEL_TIMEOUT_MS;

/** Refuses with a 404 while the switch is off, so the feature is not there at all. */
export function requireEnabled(): void {
  if (!designImportEnabled()) throw new AppError("not_found", DESIGN_IMPORT_OFF);
}

export const visionModel = (): PricedProvider | null => (designImportEnabled() ? pickVisionModel(assistantModels()) : null);

export function pipelineFor(vision: PricedProvider | null) {
  const key = getEnv().FAL_KEY;
  const image = key ? createFalProvider({ apiKey: key }) : null;
  return (usage: RouteUsage | null) => buildPipelineDeps({ vision, image, usage });
}
