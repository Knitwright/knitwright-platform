import { BASE_RATIOS, tuneForOptions, type TopsTemplate } from "./template";

/** A tee with long sleeves, a little longer in the body. */
export const LONG_SLEEVE_TEE: TopsTemplate = {
  typeId: "long-sleeve-tee",
  proportions: (options) => tuneForOptions({ ...BASE_RATIOS, "body-length": 1.38 }, options),
};
