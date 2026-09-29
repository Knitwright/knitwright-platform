import { BASE_RATIOS, tuneForOptions, type TopsTemplate } from "./template";

/** A polo shirt. The body is a little shorter and the neck opening drops less. */
export const POLO: TopsTemplate = {
  typeId: "polo",
  proportions: (options) => tuneForOptions({ ...BASE_RATIOS, "body-length": 1.3, "front-neck-drop": 0.15, "neck-width": 0.3 }, options),
};
