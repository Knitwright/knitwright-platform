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
export { isDetailAction, isMaterialAction, isMeasuredAction, unhandledAction, type DetailAction, type MaterialAction, type MeasuredAction } from "./action-groups";
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
  type SizeSystem,
  type SeamClass,
  type SeamDefinition,
  type StitchClass,
} from "./definitions";
export {
  EMPTY_FABRIC_DETAILS,
  FABRIC_FIELDS,
  FABRIC_WEIGHT_MAX_GSM,
  fabricFieldHasValue,
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
  type FabricField,
  type FabricSources,
  type FabricSpec,
  type Measurement,
  type OptionChoice,
  type PanelColour,
  type PanelFabric,
  type SizeMeasurement,
  type Sizing,
  type Tolerance,
} from "./parts";
export { sizeValueFor, sizeValuesOf, toleranceFor, tolerancesOf } from "./size-values";
export { fabricFor } from "./fabric";
export { fabricChangesSchema, type FabricChanges } from "./fabric-edit";
export {
  COMPONENT_KIND_LABELS,
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
export {
  DEFAULT_SAMPLE_NAME,
  DEFAULT_SAMPLE_NUMBER,
  LETTERING_LABELS,
  LETTERING_STYLES,
  PLACE_DEFINITIONS,
  PLAYER_MARK_PLACES,
  SAMPLE_NAME_MAX_LENGTH,
  namesAndNumbersSchema,
  placesFor,
  sampleFor,
  usualPlaces,
  type LetteringStyle,
  type NamesAndNumbers,
  type PlayerMarkPlace,
  type PlayerMarkPlacement,
} from "./names-numbers";
export {
  KIT_PATTERN_LABELS,
  KIT_PATTERN_STYLES,
  MAX_PATTERN_COLOURS,
  describeKitPattern,
  kitPatternFits,
  kitPatternSchema,
  patternColourText,
  type KitPattern,
  type KitPatternStyle,
  type PatternColour,
} from "./kit-pattern";
export { PROVENANCE_LABELS, PROVENANCE_VALUES, provenanceSchema, type Provenance } from "./provenance";
export {
  USUAL_SIZE_SYSTEM,
  getType,
  listFamilies,
  listSizeSystems,
  listTypes,
  sizeSystemFor,
  type ResolvedOption,
  type ResolvedType,
} from "./registry";
export { TEAMWEAR_TYPE_IDS } from "./registry/teamwear";
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
