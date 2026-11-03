import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO = join(__dirname, "..", "..", "..", "..", "..");

/** The spec's rulebook for JSY-SS-01, the source of the seed. */
export const RULEBOOK_MD = readFileSync(join(REPO, "docs", "spec", "articles", "JSY-SS-01", "rulebook.md"), "utf8");

/** The migration that creates and seeds the rulebook. */
export const MIGRATION = readFileSync(join(REPO, "supabase", "migrations", "20261101020000_rulebook.sql"), "utf8");

/** The follow-up migration that carries owner decisions 12 to 14 (plan v5, workstream X2b). */
export const RESEED_MIGRATION = readFileSync(
  join(REPO, "supabase", "migrations", "20261101080000_rulebook_supplier_source.sql"),
  "utf8",
);

/** The migration that records the rulebook's first sign-off (decision 0130). */
export const FIRST_SIGN_OFF_MIGRATION = readFileSync(
  join(REPO, "supabase", "migrations", "20261215030000_rulebook_first_sign_off.sql"),
  "utf8",
);
