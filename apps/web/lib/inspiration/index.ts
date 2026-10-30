/** The inspiration board (plans/platform-v5.md Z1, spec F-S1, decision 0082). Other code imports from here only. */
export { buildBoard, cardById, cardsOf, type BoardDeps } from "./board";
export { buildContextQuery, colourNamesOf, designContext, panelIdsOf, steerTag, styleTagsOf, tagText, type ContextInput } from "./context-query";
export { itemFor, itemsFrom, moodboardItemSchema, MOODBOARD_LIMIT, NOT_A_REFERENCE, type MoodboardItemInput } from "./moodboard";
export { isSuggestionDiff, pictureRefsOf, pixelBreach } from "./no-pixels";
export {
  UNWIRED_INSPIRATION_PORTS,
  type ArticleContext,
  type BrandMoodReader,
  type CardScreen,
  type DesignChecker,
  type InspirationPorts,
  type LibraryItem,
  type LibraryReader,
} from "./ports";
export { searchLinks, pinterestOn } from "./sources/external";
export { type CardProvider, type MaybeProvider } from "./sources/source";
export { suggestFromCard, type SuggestDeps, type SuggestResult, type Suggestion } from "./suggest/suggest";
export { SUGGESTION_DIFF_KINDS, diffsFor, type SuggestionDiff } from "./suggest/to-diffs";
export { elementsSchema, stubElementReader, type ElementReader, type TransferableElements } from "./suggest/elements";
export type { Attribution, Board, ContextQuery, ContextTag, InspirationCard, MoodboardItem, SearchLink, SourceResult, TagSteer } from "./types";
export { boardView, moodboardView, suggestionsView, type BoardView, type CardView, type MoodboardView, type SuggestionsView } from "./view";
export * from "./vocabulary";
