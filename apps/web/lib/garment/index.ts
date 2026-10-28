/**
 * The public surface of the garment library. Other code imports from here only.
 * It is pure: no React, no Next.js, no database and no network.
 */
export { applyAction } from "./apply-action";
export { availableChoices } from "./available-choices";
export { type Dropped } from "./dropped";
export { migrateSpec, repairSpec } from "./repair";
export { provenanceSummary } from "./provenance-summary";
export { panelsFor, pointsOfMeasureFor } from "./applicability";
export {
  componentSlotsFor,
  listSeamClasses,
  listStitchClasses,
  seamClassById,
  seamsFor,
  stitchClassById,
} from "./construction";
export { specActionSchema, type SpecAction } from "./action-schema";
export {
  isDetailAction,
  isMaterialAction,
  isMeasuredAction,
  unhandledAction,
  type DetailAction,
  type MaterialAction,
  type MeasuredAction,
} from "./action-groups";
export { checkCombination } from "./combinations";
export {
  POINT_GROUPS,
  POINT_GROUP_LABELS,
  type ComponentKind,
  type PointGroup,
  type PointOfMeasure,
} from "./definitions";
export {
  FABRIC_FIELDS,
  FABRIC_WEIGHT_MAX_GSM,
  fabricFieldHasValue,
  STRETCH_VALUES,
  SWATCH_PATTERN,
  TECHNIQUES,
  artworkSchema,
  colourwaySchema,
  sizingSchema,
  type Artwork,
  type Colourway,
  type FabricField,
  type FabricSpec,
  type Measurement,
  type OptionChoice,
  type PanelColour,
  type SizeMeasurement,
  type Sizing,
  type Tolerance,
} from "./parts";
export { sizeValueFor, toleranceFor } from "./size-values";
export { fabricFor } from "./fabric";
export { fabricChangesSchema, type FabricChanges } from "./fabric-edit";
export {
  COMPONENT_KIND_LABELS,
  LABELLING_FIELDS,
  LABELLING_LABELS,
  labellingFieldSchema,
  type LabellingField,
} from "./tech-parts";
export { WEARERS, freeText, wearerSchema, type FamilyId, type Wearer } from "./primitives";
export {
  DEFAULT_SAMPLE_NAME,
  DEFAULT_SAMPLE_NUMBER,
  LETTERING_LABELS,
  LETTERING_STYLES,
  PLACE_DEFINITIONS,
  namesAndNumbersSchema,
  placesFor,
  sampleFor,
  usualPlaces,
  type NamesAndNumbers,
  type PlayerMarkPlace,
  type PlayerMarkPlacement,
} from "./names-numbers";
export {
  KIT_PATTERN_LABELS,
  KIT_PATTERN_STYLES,
  MAX_PATTERN_COLOURS,
  describeKitPattern,
  kitPatternSchema,
  patternColourText,
  type KitPattern,
  type KitPatternStyle,
  type PatternColour,
} from "./kit-pattern";
export { PROVENANCE_LABELS, PROVENANCE_VALUES, type Provenance } from "./provenance";
export {
  USUAL_SIZE_SYSTEM,
  getType,
  listFamilies,
  listSizeSystems,
  listTypes,
  sizeSystemFor,
  type ResolvedType,
} from "./registry";
export { TEAMWEAR_TYPE_IDS } from "./registry/teamwear";
export { garmentSpecSchema, garmentSpecStructureSchema } from "./spec-schema";
export { createSpec, validateSpec, type GarmentSpec } from "./spec";
export {
  MEASUREMENT_MAX_TENTHS_MM,
  TENTHS_MM_PER_CM,
  cmToTenthsMm,
  formatCm,
  tenthsMmToCm,
} from "./units";
