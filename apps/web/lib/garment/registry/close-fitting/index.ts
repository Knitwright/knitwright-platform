import type { FamilyData } from "../../definitions";
import { CLOSE_FITTING_COMPONENTS, CLOSE_FITTING_SEAMS } from "./construction";
import { CLOSE_FITTING_OPTIONS, CLOSE_FITTING_RULES } from "./options";
import { CLOSE_FITTING_PANELS } from "./panels";
import { CLOSE_FITTING_POINTS_OF_MEASURE } from "./points-of-measure";
import { CLOSE_FITTING_TYPES } from "./types";

/** Everything the close-fitting family adds to the registry. */
export const CLOSE_FITTING: FamilyData = {
  id: "close-fitting",
  label: "Close fitting",
  options: CLOSE_FITTING_OPTIONS,
  pointsOfMeasure: CLOSE_FITTING_POINTS_OF_MEASURE,
  panels: CLOSE_FITTING_PANELS,
  rules: CLOSE_FITTING_RULES,
  seams: CLOSE_FITTING_SEAMS,
  components: CLOSE_FITTING_COMPONENTS,
  types: CLOSE_FITTING_TYPES,
};
