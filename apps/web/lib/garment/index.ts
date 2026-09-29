/**
 * The public surface of the garment library. Other code imports from here only.
 * It is pure: no React, no Next.js, no database and no network.
 */
export { applyAction, type ActionResult } from "./apply-action";
export { panelsFor, pointsOfMeasureFor, type SpecShape } from "./applicability";
export { specActionSchema, type SpecAction } from "./action-schema";
export { checkCombination, type RuleViolation } from "./combinations";
export {
  conditionSchema,
  familyDataSchema,
  garmentTypeSchema,
  optionSchema,
  panelSchema,
  pointOfMeasureSchema,
  ruleSchema,
  type Condition,
  type FamilyData,
  type GarmentType,
  type OptionChoice,
  type OptionDefinition,
  type PanelDefinition,
  type PointOfMeasure,
  type Rule,
} from "./definitions";
export {
  EMPTY_FABRIC_DETAILS,
  STRETCH_VALUES,
  TECHNIQUES,
  artworkSchema,
  colourwaySchema,
  fabricSchema,
  measurementSchema,
  panelFabricSchema,
  type Artwork,
  type Colourway,
  type FabricSpec,
  type Measurement,
  type PanelFabric,
} from "./parts";
export { fabricFor } from "./fabric";
export {
  FAMILY_IDS,
  WEARERS,
  familySchema,
  freeText,
  wearerSchema,
  type FamilyId,
  type Wearer,
} from "./primitives";
export { PROVENANCE_LABELS, PROVENANCE_VALUES, provenanceSchema, type Provenance } from "./provenance";
export {
  getType,
  listFamilies,
  listTypes,
  type ResolvedOption,
  type ResolvedType,
} from "./registry";
export { SPEC_SCHEMA_VERSION, garmentSpecSchema } from "./spec-schema";
export {
  FIRST_COLOURWAY_ID,
  FIRST_FABRIC_ID,
  createSpec,
  validateSpec,
  type GarmentSpec,
  type SpecResult,
  type ValidationResult,
} from "./spec";
export {
  MEASUREMENT_MAX_TENTHS_MM,
  TENTHS_MM_PER_CM,
  cmToTenthsMm,
  formatCm,
  tenthsMmToCm,
} from "./units";
