/**
 * The team store's numbers from the spec (decision 0153), apart from the row readers so a form in the browser can
 * use them without carrying zod.
 */

/** F-T6: "optional club margin (0/5/10/15/20%)", in basis points. */
export const MARGIN_BPS = [0, 500, 1000, 1500, 2000] as const;
export type MarginBps = (typeof MARGIN_BPS)[number];

/** F-T6: "a minimum to proceed (default 10 pieces)". */
export const DEFAULT_MIN_PIECES = 10;

/** F-T4: "Numbers are 0–99 by default". */
export const DEFAULT_NUMBER_RANGE = { min: 0, max: 99 } as const;

/** One purchase is at most this many pieces, so one checkout stays a family's, not a club's. */
export const MAX_PIECES_PER_ORDER = 10;
