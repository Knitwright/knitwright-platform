import type { Cost } from "@/lib/usage/cost";
import { FAL_VIDEO_COST_MICRODOLLARS } from "./fal";

/**
 * What one clip request reserves from the photoreal allowance (its monthly allowance and the daily ceiling are the cap, decision
 * 0012): the dearer video model's estimated price, so a real adapter is covered. The stub costs nothing but reserves the same, so
 * the cap behaves the same in tests as live. A labelled estimate, not a quote.
 */
export const CLIP_COST: Cost = { feature: "photoreal", microdollars: FAL_VIDEO_COST_MICRODOLLARS };
