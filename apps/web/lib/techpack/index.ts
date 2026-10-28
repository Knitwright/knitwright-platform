/**
 * The public surface of the tech pack library. Other code imports from here only.
 * It is pure: no React, no Next.js, no database, no network and no clock.
 */
export { buildTechPack } from "./build";
export { TBC, TO_BE_CONFIRMED, sourceLabel } from "./cell";
export {
  completenessReport,
  confirmSentence,
  type CompletenessReport,
  type ConfirmItem,
  type ConfirmSection,
} from "./completeness";
export { PROPOSAL_WORDS, listOf } from "./text";
export { flatsForTechPack } from "./flats";
export { type RevisionInput } from "./input";
export { SUGGESTION_SOURCES } from "./suggested";
export { allCells } from "./walk";
export * from "./types";
