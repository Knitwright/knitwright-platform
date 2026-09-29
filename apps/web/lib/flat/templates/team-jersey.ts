import { BASE_RATIOS, tuneForOptions, type TopsTemplate } from "./template";

/** A team jersey. It is longer than a tee and a little roomier at the hem. */
export const TEAM_JERSEY: TopsTemplate = {
  typeId: "team-jersey",
  proportions: (options) => tuneForOptions({ ...BASE_RATIOS, "body-length": 1.42, "hem-width": 1.02, "shoulder-width": 0.9 }, options),
};
