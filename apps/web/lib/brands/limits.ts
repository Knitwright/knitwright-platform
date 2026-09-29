/**
 * Limits on brands. The database enforces both. They are repeated here so forms can
 * say them before the user runs into them. `tests/integration/brands.test.ts` fails if
 * the two ever disagree.
 */
export const BRAND_NAME_MAX = 80;
export const MAX_BRANDS = 3;
