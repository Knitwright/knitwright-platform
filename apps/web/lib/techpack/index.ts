/**
 * The public surface of the tech pack library. Other code imports from here only.
 * It is pure: no React, no Next.js, no database, no network and no clock.
 */
export { buildTechPack } from "./build";
export { calloutCodes, codeFor, pointsInTableOrder, type CalloutCode } from "./codes";
export { STANDARD_CHOICE, TBC, TO_BE_CONFIRMED, isSet, sourceLabel, textCell } from "./cell";
export {
  completenessReport,
  confirmSentence,
  type CompletenessReport,
  type ConfirmItem,
  type ConfirmSection,
} from "./completeness";
export { PROPOSAL_WORDS, listOf } from "./text";
export { flatsForTechPack, withCalloutCodes } from "./flats";
export { REVISIONS_SHOWN, type RevisionInput, type TechPackInput } from "./input";
export { SUGGESTION_SOURCES } from "./suggested";
export { allCells, leaves } from "./walk";
export { NOBODY_HAS_CHECKED } from "./sign-off";
export * from "./types";
