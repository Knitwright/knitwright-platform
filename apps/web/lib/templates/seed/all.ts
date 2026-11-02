import { buildSeedTemplates, type SeedTemplate } from "./build";
import { buildBlockSeeds } from "./launch/blocking";
import { LAUNCH_BLOCK_PLANS, LAUNCH_KIT_STYLE_PLANS } from "./launch/plans";
import { buildTeamwearSeeds } from "./teamwear/build";

/**
 * Every design template: the first twelve, the football and cricket articles, and the starters that take
 * the library to the 60 design templates of `docs/spec/07-template-library.md` (plan v5 L8, decision 0098).
 */
export const allSeedTemplates = (): readonly SeedTemplate[] => [
  ...buildSeedTemplates(),
  ...buildTeamwearSeeds(),
  ...buildSeedTemplates(LAUNCH_KIT_STYLE_PLANS),
  ...buildBlockSeeds(LAUNCH_BLOCK_PLANS),
];
