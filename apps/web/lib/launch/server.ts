import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creditSummaryFor } from "@/lib/credits/server";
import { PLACEHOLDER_NOTICE } from "@/lib/credits/settings";
import { LAUNCH_GAP_RULE } from "./boards";
import type { LaunchCostSource } from "./costs";
import { listArtboardPresets, listLaunchProjects, loadLaunchProject } from "./service";
import type { ArtboardPreset, LaunchProjectSummary, LaunchProjectView } from "./types";

/**
 * Joins the launch screens to the database, the artboard presets and the brand's credits. It holds
 * no rules of its own -- `graph.ts`, `costs.ts`, `artboard.ts` and `page-state.ts` have those and
 * are tested on their own -- and the database tests and the end-to-end test cover the joining.
 */

export interface LaunchHome {
  readonly projects: readonly LaunchProjectSummary[];
  readonly presets: readonly ArtboardPreset[];
}

export const loadLaunchHome = async (client: SupabaseClient, brandId: string): Promise<LaunchHome> => {
  const [projects, presets] = await Promise.all([listLaunchProjects(client, brandId), listArtboardPresets(client)]);
  return { projects, presets };
};

export interface LaunchCanvas {
  readonly project: LaunchProjectView;
  readonly presets: readonly ArtboardPreset[];
  /** The brand's balance, or null when it could not be read. A run is never charged against null. */
  readonly credits: number | null;
  readonly costs: LaunchCostSource;
}

/**
 * What a generated board costs, from the platform's own credit prices. Launch has no price of its
 * own: a picture or a clip is marketing media, which already has a price a platform admin sets.
 * The note is the credits page's own placeholder notice, so the shell never writes a sentence about
 * prices that the credits code does not already say.
 */
const costsFrom = (prices: Readonly<Record<string, number>>, isPlaceholder: boolean): LaunchCostSource => ({
  perGeneratedBoard: prices["marketing_media"] ?? 1,
  note: isPlaceholder ? PLACEHOLDER_NOTICE : "Set by a platform admin in the credit prices.",
  ruleId: LAUNCH_GAP_RULE,
});

const FALLBACK_COSTS: LaunchCostSource = {
  perGeneratedBoard: 1,
  note: "The credit prices could not be read just now, so this figure is not the one that would be charged.",
  ruleId: LAUNCH_GAP_RULE,
};

/** One canvas with the presets, the balance and the cost figure, or null when the canvas is gone. */
export async function loadLaunchCanvas(client: SupabaseClient, brandId: string, launchProjectId: string): Promise<LaunchCanvas | null> {
  const project = await loadLaunchProject(client, brandId, launchProjectId);
  if (project === null) return null;
  const [presets, credits] = await Promise.all([
    listArtboardPresets(client),
    // A credit problem must never stop the canvas opening, as the balance chip already holds.
    creditSummaryFor(brandId)
      .then((summary) => ({ balance: summary.balance, costs: costsFrom(summary.prices, summary.isPlaceholder) }))
      .catch(() => ({ balance: null, costs: FALLBACK_COSTS })),
  ]);
  return { project, presets, credits: credits.balance, costs: credits.costs };
}
