import { microdollars, type Cost } from "@/lib/usage/cost";

/**
 * The estimated cost of one request for photoreal images: a front and a back, reserved
 * together as one usage record. Plan step 14, task 4, and decision record 0012.
 *
 * Reserved at the dearer of the two providers, so either is covered: $0.08 an image for
 * fal-ai/nano-banana-2/edit at 1K (fal's model page, checked 2026-10-13). Google directly is
 * $0.067 (checked 2026-09-29, docs/data-processing.md).
 */
export const PRICE_PER_IMAGE_DOLLARS = 0.08;

export const IMAGES_PER_REQUEST = 2;

export const PHOTOREAL_COST: Cost = {
  feature: "photoreal",
  microdollars: microdollars(PRICE_PER_IMAGE_DOLLARS * IMAGES_PER_REQUEST),
};
