/**
 * The fixed words of the base article catalogue (plans/platform-v5.md X1, decision 0066). The database checks the same
 * lists, so a value the code does not know cannot be stored.
 */

/** Class A: sublimated on demand. Class B: small runs on stock-colour fabric (spec 01, decision 4). */
export const PRODUCTION_CLASSES = ["A", "B"] as const;
export type ProductionClass = (typeof PRODUCTION_CLASSES)[number];

/** Where a base article is on its way to the catalogue (spec ONBOARDING.md, the 9 steps). */
export const ARTICLE_STATUSES = ["draft", "sampling", "live"] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

/** Which front door offers the article (spec ONBOARDING.md, "Serves"). */
export const ARTICLE_USES = ["teamwear", "studio"] as const;
export type ArticleUse = (typeof ARTICLE_USES)[number];

/**
 * How a point of measure changes between sizes. `fixed` is the word the worked article (JSY-SS-01/article.json) uses
 * for a point that keeps one value in every size, so it is kept as written rather than renamed.
 */
export const GRADE_TYPES = ["linear", "non_linear", "ungraded", "fixed"] as const;
export type GradeType = (typeof GRADE_TYPES)[number];

export const PARAMETER_TYPES = ["range", "enum", "bool"] as const;
export type ParameterType = (typeof PARAMETER_TYPES)[number];

/** What a fabric does on the article: the main body, or the rib for collars and cuffs. */
export const FABRIC_ROLES = ["body", "rib"] as const;
export type FabricRole = (typeof FABRIC_ROLES)[number];

/** A rulebook id, as `R-SUB-004` (plan v5 rules, spec decision 11). */
export const RULE_ID = /^R-[A-Z]{2,5}-\d{3}$/;

/**
 * The id a value carries when the rulebook has no entry for it yet (plan v5, "Every rule explains itself"). The
 * rulebook (X2) seeds it as "No rule written yet; the team has been told". Used here for the pattern-fill options of
 * JSY-SS-01, which `article.json` gives no rule: an option is never stored with no rule at all.
 */
export const RULE_GAP = "R-GAP-000";

/** A base article code, as `JSY-SS-01`: article type, variant, number. */
export const ARTICLE_CODE = /^[A-Z]{3}-[A-Z]{2}-[A-Z0-9]{2}$/;

/** A fabric programme code, as `F-POLY-INT`. */
export const FABRIC_CODE = /^F-[A-Z0-9]+(-[A-Z0-9]+)*$/;

/** Every seeded article carries this label until a factory has reviewed it. */
export const DRAFT_LABEL = "Knitwright draft v0.1, not reviewed by a factory";

/** What a parameter range or option says before a sample at its ends exists. */
export const NOT_YET_SAMPLED = "Not yet sampled";

/** The article type of a code: its first part, so `JSY` for `JSY-SS-01`. */
export const articleTypeOf = (code: string): string => code.split("-")[0] ?? "";
