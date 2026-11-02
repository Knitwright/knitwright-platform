/**
 * The words and limits a sign-up page shows (spec F-T4, plan v5 Z7, decision 0086).
 *
 * No zod here, so a browser component can import them without shipping the schema library
 * (`tests/architecture/client-weight.test.ts`). Nothing here is a rule: every number the sign-up
 * form checks a player against comes from a row (`numbers.ts`, `zones.ts`), never from this file.
 */

/** The longest a name may be before it is even looked at, so a huge paste is refused early. */
export const RAW_NAME_MAX = 200;
/** The most people one season may be waiting on. The database holds the same number. */
export const REQUESTS_MAX = 200;
/** The most characters a pasted list may hold: 200 people at a generous line each. */
export const PASTE_MAX = 20_000;

/** The sports the number rules are seeded for. The list a club chooses from comes from the rows. */
export const DEFAULT_SPORT = "default";

export const NAME_LABEL = "Name on your shirt";
export const NAME_HINT = "Usually a surname, in capitals. It is printed exactly as you type it.";
export const NUMBER_LABEL = "Your number";
export const SIZE_LABEL = "Your size";
export const WEARER_LABEL = "Which cut";

export const PAGE_LEAD = "Three things and you are done. Your club prints what you type here, so check your spelling.";

/** What the page says when the club has not set a size run, so there is no size to choose. */
export const NO_SIZES_NOTE =
  "Your club has not set its sizes yet, so there is nothing to choose from. Tell the person who sent you this link.";

/** What a player sees once their answer is kept. */
export const ANSWER_KEPT =
  "Thank you. Your club has your shirt name, your number and your size. Open this link again from this browser to change them.";

/** The one sentence about what happens to what a player types. */
export const PRIVACY_NOTE =
  "Your club sees your name, your number and your size, and uses them to order your kit. We do not ask for your email address and we will not contact you.";

/**
 * What a link that no longer works says. A link that ran out, a link that was withdrawn and an
 * address that was never a link all take this one path and this one answer, because telling them
 * apart would say whether a link exists (decision 0026).
 */
export const LINK_CLOSED_TITLE = "This link does not work";
export const LINK_CLOSED_BODY =
  "It may have run out, it may have been withdrawn, or the address may be wrong. Ask the person at your club who sent it to you for a new one.";

/** The two states of the collected-versus-missing grid, in the words the club reads. */
export const COLLECTED_LABEL = "In";
export const MISSING_LABEL = "Still waiting";

/** What the grid says when nobody has been added to the list yet, and the one action that fills it. */
export const NO_REQUESTS_YET = "Nobody on the list yet. Paste your squad's names, one per line, and we will tell you who is still missing.";

/** What the grid says when the whole list has answered. */
export const ALL_IN = "Everyone on your list has answered.";

/** What an answer from someone who is not on the list is called, so a club is never surprised by one. */
export const EXTRA_LABEL = "Not on your list";
