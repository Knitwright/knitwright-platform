import { IMAGE_EDIT_CATALOG, IMAGE_INPUT_TOKENS, MAX_OUTPUT_TOKENS, MAX_TEXT_INPUT_TOKENS, callCost, type ModelEntry } from "@/lib/providers/catalog";
import { ModelCallError, type ModelRequest, type TextModelProvider } from "@/lib/providers/text-model";
import { ProviderError, type ImageProvider } from "@/lib/providers/image-provider";
import type { RouteUsage } from "@/lib/server/core/metered";
import type { Cost } from "@/lib/usage/cost";
import type { Spend } from "./budget";

/** What an import costs and how each call is reserved. The prices come from lib/providers/catalog.ts; none is stated here. */

const IMAGE_EDIT_MICRODOLLARS = IMAGE_EDIT_CATALOG[0].microdollarsPerImage;

/** One vision call at the most it can use: the instructions, the picture and the doubled output limit. */
export const visionCost = (entry: ModelEntry): Cost => ({ feature: "ai", microdollars: callCost(entry, MAX_TEXT_INPUT_TOKENS + IMAGE_INPUT_TOKENS, MAX_OUTPUT_TOKENS * 2) });
export const editCost = (): Cost => ({ feature: "photoreal", microdollars: IMAGE_EDIT_MICRODOLLARS });

/** What an import used, in whole microdollars, at the most each call can cost. For the owner's cost view. */
export const spentMicrodollars = (entry: ModelEntry, spend: Spend): number => spend.visionCalls * visionCost(entry).microdollars + spend.imageEdits * IMAGE_EDIT_MICRODOLLARS;

export const OVER_ALLOWANCE = "Your allowance for reading pictures is used up for now. Nothing was changed.";

/** The first vision call uses the reservation the route already holds; each later call reserves its own and gives it back if it fails. */
export function meterVision(provider: TextModelProvider, entry: ModelEntry, usage: RouteUsage | null): TextModelProvider {
  let calls = 0;
  return {
    provider: provider.provider,
    model: provider.model,
    async complete(request: ModelRequest) {
      calls += 1;
      if (usage === null || calls === 1) return provider.complete(request);
      const held = await usage.reserve(visionCost(entry));
      if (held === null) throw new ModelCallError(OVER_ALLOWANCE);
      try {
        return await provider.complete(request);
      } catch (error) {
        await held.refund();
        throw error;
      }
    },
  };
}

/** Each image edit reserves its own cost against the picture allowance and gives it back if the edit fails. */
export function meterEdits(provider: ImageProvider, usage: RouteUsage | null): ImageProvider {
  return {
    name: provider.name,
    async generate(request, signal) {
      if (usage === null) return provider.generate(request, signal);
      const held = await usage.reserve(editCost());
      if (held === null) throw new ProviderError(OVER_ALLOWANCE, true);
      try {
        return await provider.generate(request, signal);
      } catch (error) {
        await held.refund();
        throw error;
      }
    },
  };
}
