import type { FamilyData } from "../../definitions";
import { TOPS_COMPONENTS, TOPS_SEAMS } from "./construction";
import { TOPS_OPTIONS } from "./options";
import { TOPS_PANELS } from "./panels";
import { TOPS_POINTS_OF_MEASURE } from "./points-of-measure";
import { TOPS_RULES } from "./rules";
import { TOPS_TYPES } from "./types";

/** Everything the tops family adds to the registry. */
export const TOPS: FamilyData = {
  id: "tops",
  label: "Tops",
  options: TOPS_OPTIONS,
  pointsOfMeasure: TOPS_POINTS_OF_MEASURE,
  panels: TOPS_PANELS,
  rules: TOPS_RULES,
  seams: TOPS_SEAMS,
  components: TOPS_COMPONENTS,
  types: TOPS_TYPES,
};
