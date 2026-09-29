import { BASE_RATIOS, tuneForOptions, type TopsTemplate } from "./template";

/** A V neck tee. The neck opening is a little wider than a round neck. */
export const V_NECK_TEE: TopsTemplate = {
  typeId: "v-neck-tee",
  proportions: (options) => tuneForOptions({ ...BASE_RATIOS, "neck-width": 0.38 }, options),
};
