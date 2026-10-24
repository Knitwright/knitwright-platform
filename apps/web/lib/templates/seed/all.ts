import { buildSeedTemplates, type SeedTemplate } from "./build";
import { buildTeamwearSeeds } from "./teamwear/build";

/** Every starter template: the first twelve, then the football and cricket articles. */
export const allSeedTemplates = (): readonly SeedTemplate[] => [...buildSeedTemplates(), ...buildTeamwearSeeds()];
