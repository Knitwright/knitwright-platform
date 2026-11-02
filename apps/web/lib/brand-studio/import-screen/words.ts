/**
 * The words the brand import SCREEN adds to L7's engine (decision 0102 item 10, built by decision
 * 0106). Everything the proposal itself says -- the stage lines, the empty states, the refusals,
 * the rights ask -- is already in `lib/brand-studio/import/words.ts` and is not written again here.
 *
 * No zod, so the screen can import these without shipping the schema library.
 */

export const PAGE_TITLE = "Import your brand";

export const PAGE_LEAD =
  "Paste the address of your own website or Instagram page. Knitwright reads one page of it, works out your logos, colours, fonts and a written visual style, and drops the page itself. You choose what to keep.";

export const URL_LABEL = "Your site's address";
export const URL_PLACEHOLDER = "https://yourclub.com";
export const RUN = "Read my site";
export const RUNNING = "Reading your site";

/** The one sentence a person needs while a minute of work happens. */
export const RUN_TAKES_A_MINUTE = "This takes about a minute. Stay on this page while it runs.";

export const KEEP_WHAT_I_CHOSE = "Save what I chose";
export const SAVING = "Saving";
export const NOTHING_CHOSEN = "Nothing is being kept yet, so there is nothing to save. Keep a colour, a font or the visual style first.";

export const saved = (parts: readonly string[]): string => `Saved to your brand: ${parts.join(", ")}.`;

export const SAVE_FAILED = "That could not be saved. Try again in a moment; nothing was changed.";

export const COMPLETION_HEADING = "How far your brand has got";
export const STILL_TO_DO = "Still to do";

export const RIGHTS_HEADING = "Your pictures";

/**
 * **The honest limit of this screen.** A kept picture has to be fetched once more from the address
 * the run read, and the proposal has been to the browser and back by then, so the address is no
 * longer one the server itself chose. Saving it would mean storing a picture from an address a
 * browser handed us. The run row of owner question 2 is what fixes that, and until it exists this
 * screen saves the three texts, the colours and the fonts and says this about the pictures.
 */
export const PICTURES_NOT_SAVED_YET =
  "Keeping a picture needs it read from your site a second time, and this screen cannot do that safely until an import survives a reload. Your logos and photos are listed so you can see what was found; add them from your uploads for now.";

/** The gap that sentence rests on, for the pull request and the screen. */
export const PICTURE_WIRING_GAP = {
  ruleId: "R-GAP-000",
  line: "How a brand proves a pasted address is its own is written down nowhere, so a picture read from that address is not stored from this screen.",
} as const;
