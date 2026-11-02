/**
 * The words, limits and lists a committee page shows (spec F-T3, plan v5 Z7, decision 0087).
 *
 * No zod here, so a browser component can import them without shipping the schema library
 * (`tests/architecture/client-weight.test.ts`). The schemas in `schemas.ts` re-export this file for
 * the server.
 */

/** The three choices a committee link can offer. F-T3: a vote on version A, B or C. */
export const COMMITTEE_SLOTS = ["A", "B", "C"] as const;
export type CommitteeSlot = (typeof COMMITTEE_SLOTS)[number];

export const isCommitteeSlot = (value: unknown): value is CommitteeSlot =>
  COMMITTEE_SLOTS.some((slot) => slot === value);

/** The same length a share answer's name takes (decision 0026), so one person is one name everywhere. */
export const NAME_MAX = 60;
/** An email address is offered, never asked for (F-T3: "commenters give a name; an email is optional"). */
export const EMAIL_MAX = 254;
/** The same length a design comment takes (decision 0063), because a pin is one. */
export const PIN_MAX = 2000;

/** The furthest a pin can sit from the top left of a panel, in millimetres, as a design comment holds it. */
export const PIN_MM_MAX = 5000;

export const NAME_RULE = `Enter your name, up to ${NAME_MAX} characters.`;
export const EMAIL_RULE = "That is not an email address. Leave it empty if you would rather not give one.";
export const PIN_RULE = `Write what you want changed, up to ${PIN_MAX} characters.`;
export const POINT_RULE = "Press the drawing to choose the place you mean.";

/** What a visitor is told about what happens to what they type. */
export const PRIVACY_NOTE =
  "Your name, your comments, your vote and your approval are seen by the club. An email address is optional and is used only to reach you about this kit.";

/** The one line under the heading, which says what the page is for and that nothing here is settled. */
export const PAGE_LEAD = "Look at each option, pin a comment where you want a change, choose the one you prefer, and give your approval under your name.";

/** What the page says when the club has shared only one version: there is nothing to vote between. */
export const ONE_VERSION_NOTE = "The club shared one option, so there is nothing to choose between. You can still pin a comment and give your approval.";

/** What a page with no pins yet says, and the one action that fills it. */
export const NO_PINS_YET = "No comments yet. Press a drawing where you want something changed, then write what you mean.";

/** What the club's own screen says when nobody has answered yet. */
export const NO_ANSWERS_YET = "Nobody has answered yet. Copy the link and send it to your committee.";

/** What a visitor sees once their approval is recorded. It claims nothing about the design itself. */
export const APPROVAL_RECORDED =
  "Your approval is recorded with your name, the time and the option you chose. Tell the club if you change your mind: an approval is a record and is never removed.";

/**
 * What a link that no longer works says. A link that ran out, a link that was withdrawn and an
 * address that was never a link all take this one path and this one answer, because telling them
 * apart would say whether a link exists (decision 0026).
 */
export const LINK_CLOSED_TITLE = "This link does not work";
export const LINK_CLOSED_BODY =
  "It may have run out, it may have been withdrawn, or the address may be wrong. Ask the person at the club who sent it to you for a new one.";

/** The label of each slot, as the page names it. */
export const slotLabel = (slot: CommitteeSlot): string => `Option ${slot}`;
