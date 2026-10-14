/**
 * Limits and choices the share forms show in the browser. Kept apart from the zod schemas
 * (lib/share/schemas.ts), which also reach node:crypto through the token module.
 */

/** Limits on what a visitor writes. The database enforces the same ones. */
export const NAME_MAX = 60;
export const COMMENT_MAX = 1000;

/** How long a link may last, in days. The database accepts only these. */
export const LINK_DAYS = ["7", "30", "90"] as const;
export const DEFAULT_LINK_DAYS = "30";
