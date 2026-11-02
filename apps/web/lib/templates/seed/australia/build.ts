import { buildSeedTemplates, type SeedTemplate } from "../build";
import { buildBlockSeeds } from "../launch/blocking";
import { AUSTRALIA_BLOCK_PLANS, AUSTRALIA_KIT_STYLE_PLANS } from "./plans";

/**
 * The Australian starters, built the same way the launch starters are (plan v5 O3, decision 0103):
 * from an article of the registry, a wearer it offers, options it offers and a colour of the editor's
 * own palette. Built the same way every time — no date and no random id — so the same code gives the
 * same rows.
 */
export const AUSTRALIA_SEED_COUNT = AUSTRALIA_KIT_STYLE_PLANS.length + AUSTRALIA_BLOCK_PLANS.length;

export const australiaSeedTemplates = (): readonly SeedTemplate[] => [
  ...buildSeedTemplates(AUSTRALIA_KIT_STYLE_PLANS),
  ...buildBlockSeeds(AUSTRALIA_BLOCK_PLANS),
];
