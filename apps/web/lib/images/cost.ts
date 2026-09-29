import { microdollars, type Cost } from "@/lib/usage/cost";

/**
 * The estimated cost of one request for photoreal images: a front and a back, reserved
 * together as one usage record. Plan step 14, task 4, and decision record 0012.
 *
 * $0.067 an image for gemini-3.1-flash-image at about 1K (Google's price list, checked
 * 2026-09-29, docs/data-processing.md), rounded up to $0.07 for the words sent with it.
 */
export const PRICE_PER_IMAGE_DOLLARS = 0.07;

export const IMAGES_PER_REQUEST = 2;

export const PHOTOREAL_COST: Cost = {
  feature: "photoreal",
  microdollars: microdollars(PRICE_PER_IMAGE_DOLLARS * IMAGES_PER_REQUEST),
};
