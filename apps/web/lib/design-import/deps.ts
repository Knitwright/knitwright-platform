import type { ImageProvider } from "@/lib/providers/image-provider";
import type { ModelChoice, PricedProvider } from "@/lib/providers/select";
import type { RouteUsage } from "@/lib/server/core/metered";
import { createBudget, type Budget } from "./budget";
import { createCleanUp } from "./cleanup";
import { meterEdits, meterVision } from "./cost";
import type { PipelineDeps } from "./pipeline";
import { pendingPatternStage } from "./pattern";
import { STAND_IN_MAPPER, STAND_IN_TEMPLATE } from "./template";

/**
 * Which models read a picture. The reading asks for a JSON object in plain text, so a model that is forced to call
 * the assistant's reply tool cannot be used (the provider layer forces the tool for those). The first configured
 * model that is free to answer in text is chosen; none means the feature is shown as not available.
 */
export function pickVisionModel(choice: ModelChoice): PricedProvider | null {
  return [choice.primary, choice.retry].find((candidate): candidate is PricedProvider => candidate !== null && !candidate.entry.forcedTool) ?? null;
}

export function buildPipelineDeps(options: {
  readonly vision: PricedProvider | null;
  readonly image: ImageProvider | null;
  readonly usage: RouteUsage | null;
  readonly budget?: Budget;
}): PipelineDeps {
  const budget = options.budget ?? createBudget();
  return {
    provider: options.vision ? meterVision(options.vision.provider, options.vision.entry, options.usage) : null,
    template: STAND_IN_TEMPLATE,
    mapper: STAND_IN_MAPPER,
    pattern: pendingPatternStage,
    cleanup: options.image ? createCleanUp(meterEdits(options.image, options.usage), budget) : null,
    budget,
    // Until W1's pattern library and W3's mapper are on main, the picture is fitted to the benchmark tee pattern.
    standIn: true,
  };
}
