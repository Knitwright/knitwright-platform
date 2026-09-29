/**
 * The public surface of the garment library. Other code imports from here only.
 * It is pure: no React, no Next.js, no database and no network.
 */
export { applyAction, type ActionResult } from "./apply-action";
export { availableChoices, type AvailableChoice } from "./available-choices";
export { type Dropped, type DroppedKind } from "./dropped";
export { migrateSpec, repairSpec, type MigrateResult } from "./repair";
export { provenanceSummary, type ProvenanceItem } from "./provenance-summary";
export { type ChoiceMap } from "./conditions";
export { panelsFor, pointsOfMeasureFor, type SpecShape } from "./applicability";
export {
  componentSlotsFor,
  listSeamClasses,
  listStitchClasses,
  seamClassById,
  seamsFor,
  stitchClassById,
  type ResolvedSeam,
} from "./construction";
export { specActionSchema, type SpecAction } from "./action-schema";
export { checkCombination, type RuleViolation } from "./combinations";
export {
  conditionSchema,
  familyDataSchema,
  garmentTypeSchema,
  COMPONENT_KINDS,
  POINT_GROUPS,
  POINT_GROUP_LABELS,
  optionSchema,
  panelSchema,
  pointGroupSchema,
  pointOfMeasureSchema,
  ruleSchema,
  type ComponentKind,
  type ComponentSlot,
  type Condition,
  type FamilyData,
  type GarmentType,
  type OptionDefinition,
  type PointGroup,
  type PanelDefinition,
  type PointOfMeasure,
  type Rule,
  type SeamClass,
  type SeamDefinition,
  type StitchClass,
} from "./definitions";
export {
  EMPTY_FABRIC_DETAILS,
  STRETCH_VALUES,
  SWATCH_PATTERN,
  TECHNIQUES,
  artworkSchema,
  colourwaySchema,
  fabricSchema,
  measurementSchema,
  optionChoiceSchema,
  panelFabricSchema,
  sizingSchema,
  type Artwork,
  type Colourway,
  type FabricSpec,
  type Measurement,
  type OptionChoice,
  type PanelColour,
  type PanelFabric,
  type Sizing,
} from "./parts";
export { fabricFor } from "./fabric";
export {
  LABELLING_FIELDS,
  LABELLING_LABELS,
  componentSchema,
  constructionEntrySchema,
  labellingFieldSchema,
  labellingSchema,
  type ComponentEntry,
  type ConstructionEntry,
  type Labelling,
  type LabellingField,
  type LabellingValue,
} from "./tech-parts";
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
export { SPEC_SCHEMA_VERSION, garmentSpecSchema, garmentSpecStructureSchema } from "./spec-schema";
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
