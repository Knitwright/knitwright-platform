/**
 * The real `KppInput` builder (plan v5 X5b item 1, decision 0070 revision 2): one production package input built
 * from the rows the platform stores, with every value no row holds marked `needs_input` rather than guessed.
 */
export { buildKppInput, buildNotes } from "./build";
export { colourSpec } from "./colour";
export { overviewFields } from "./fields";
export { careLabels, wordingFromRule } from "./labels";
export { billOfMaterials, BOM_ITEM_IDS } from "./materials";
export { measurements, type PomRow } from "./measurements";
export { chosenFabric, NOTHING_UNSOURCED } from "./model";
export type { ConsumptionRow, DesignFacts, KppRows, KppUnsourced, LabelWordingRow, QualityPlan } from "./model";
export { printRules, qualityChecklist, samplingPlan } from "./quality";
