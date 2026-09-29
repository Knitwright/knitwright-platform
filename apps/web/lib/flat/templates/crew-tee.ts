import { BASE_RATIOS, tuneForOptions, type TopsTemplate } from "./template";

/** A plain round neck tee. It uses the shared proportions as they are. */
export const CREW_TEE: TopsTemplate = {
  typeId: "crew-tee",
  proportions: (options) => tuneForOptions({ ...BASE_RATIOS }, options),
};
