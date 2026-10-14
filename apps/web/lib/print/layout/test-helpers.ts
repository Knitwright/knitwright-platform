import { offsetOutline } from "@/lib/production/geometry/offset";
import type { Pt } from "../geometry/vec";
export { boundsOf } from "../geometry/vec";

export const offsetPoly = (outline: readonly Pt[], by: number): Pt[] => offsetOutline(outline, by);
