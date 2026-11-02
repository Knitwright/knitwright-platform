/**
 * Brand import from a URL (spec F-S9 Phase 3, plan v5 L7, decision 0102).
 *
 * The one way in is `runImport`: it reads one page of the brand's **own** site, derives logos,
 * colours, fonts, product photos and a written visual style from it, and hands back a proposal in
 * which nothing has been taken in yet. The person then says yes or no to each row (`decisions.ts`),
 * ticks the rights box if they want their pictures kept, and `planOf` turns what is left into the
 * bodies `lib/brand-studio/service.ts` already saves.
 *
 * Nothing in this directory writes to the database or to storage, and no shape it returns can hold
 * a page's markup or a picture's bytes.
 */

export { planOf, profileFor, acceptedStyle, changesNothing, type ImportPlan } from "./apply";
export { acceptedPictures, countOf, decide, decideKind, itemsOfKind, tickRights, uploadsFor, whyNoUploads } from "./decisions";
export { coloursOfStyles, fontsOfPage, linksOfPage, ownAddress, sameSite, siteOf, stylesOf } from "./discover";
export { ownUrl, readOwnPage, readPicture, refuse, type Fetcher } from "./fetch";
export { fontDetail, kindOf, nearestUsable, proposedFonts, roleWants } from "./fonts";
export { itemId, itemsOf, pictureLabel } from "./items";
export { IMPORTED_PALETTE_NAME, colourOf, distinct, proposedColours, seenColours } from "./palette";
export { factsOf, pictureDetail, readPictures, SMALLEST_PICTURE_PX } from "./pictures";
export { runImport, type ImportDeps, type ImportInput, type Limiter, type Who } from "./run";
export {
  DEFAULT_IMPORT_SETTINGS,
  IMPORT_SETTING_KEYS,
  SETTINGS_SOURCE,
  brandRunKey,
  hostRequestKey,
  importLimits,
  importSettingsWith,
  type BrandImportSettings,
} from "./settings";
export {
  ALLOWANCE_USED_UP,
  EMPTY_STYLE,
  STYLE_SYSTEM,
  createModelStyleWriter,
  createScriptedStyleWriter,
  createStubStyleWriter,
  factOf,
  meteredStyleWriter,
  styleCostMicrodollars,
  styleFrom,
  type StyleInput,
  type VisualStyleWriter,
} from "./style";
export type * from "./types";
export { completionView, emptyView, errorView, groupsOf, importView, progressOf, stageLines, type ImportView } from "./view";
export * from "./words";
