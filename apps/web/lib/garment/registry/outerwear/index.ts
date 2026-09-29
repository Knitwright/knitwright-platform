import type { FamilyData } from "../../definitions";
import { OUTERWEAR_COMPONENTS, OUTERWEAR_SEAMS } from "./construction";
import { OUTERWEAR_OPTIONS, OUTERWEAR_RULES } from "./options";
import { OUTERWEAR_PANELS } from "./panels";
import { OUTERWEAR_POINTS_OF_MEASURE } from "./points-of-measure";
import { OUTERWEAR_TYPES } from "./types";

/** Everything the outerwear family adds to the registry. */
export const OUTERWEAR: FamilyData = {
  id: "outerwear",
  label: "Outerwear",
  options: OUTERWEAR_OPTIONS,
  pointsOfMeasure: OUTERWEAR_POINTS_OF_MEASURE,
  panels: OUTERWEAR_PANELS,
  rules: OUTERWEAR_RULES,
  seams: OUTERWEAR_SEAMS,
  components: OUTERWEAR_COMPONENTS,
  types: OUTERWEAR_TYPES,
};
