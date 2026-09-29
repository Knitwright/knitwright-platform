import type { FamilyData } from "../../definitions";
import { BOTTOMS_COMPONENTS, BOTTOMS_SEAMS } from "./construction";
import { BOTTOMS_OPTIONS, BOTTOMS_RULES } from "./options";
import { BOTTOMS_PANELS } from "./panels";
import { BOTTOMS_POINTS_OF_MEASURE } from "./points-of-measure";
import { BOTTOMS_TYPES } from "./types";

/** Everything the bottoms family adds to the registry. */
export const BOTTOMS: FamilyData = {
  id: "bottoms",
  label: "Bottoms",
  options: BOTTOMS_OPTIONS,
  pointsOfMeasure: BOTTOMS_POINTS_OF_MEASURE,
  panels: BOTTOMS_PANELS,
  rules: BOTTOMS_RULES,
  seams: BOTTOMS_SEAMS,
  components: BOTTOMS_COMPONENTS,
  types: BOTTOMS_TYPES,
};
