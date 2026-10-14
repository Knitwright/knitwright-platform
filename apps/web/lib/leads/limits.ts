/**
 * Lengths the leads forms show in the browser. Kept apart from the zod schemas
 * (lib/leads/admin.ts, lib/leads/access.ts) so those forms do not ship zod to the browser.
 */

/** The longest "next step" note on a lead. */
export const NEXT_STEP_MAX = 200;

/** A request for access from the sign-up page. */
export const ACCESS_NAME_MAX = 80;
export const ACCESS_ORGANISATION_MAX = 80;
export const ACCESS_MESSAGE_MAX = 1000;
