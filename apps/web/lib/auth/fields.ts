/**
 * Field names and limits the sign-in forms show in the browser. Kept apart from the zod
 * schemas (lib/auth/schemas.ts) so a form does not ship zod to the browser.
 */

/** The field name the Turnstile widget adds to a form. */
export const CAPTCHA_FIELD = "cf-turnstile-response";

export const PASSWORD_MIN = 10;
/** Passwords are hashed with bcrypt, which ignores everything after 72 bytes. */
export const PASSWORD_MAX_BYTES = 72;
