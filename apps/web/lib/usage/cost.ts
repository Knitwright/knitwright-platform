/**
 * The unit of account for AI spend. Plan step 10, task 1.
 *
 * Costs are estimated before a call and kept in microdollars: whole millionths of a US
 * dollar. A cheap text call costs a small fraction of a cent, which whole cents would
 * round away. Decision record 0012.
 */

/** "ai" is text and image reading. "photoreal" is generated pictures, with an allowance of their own. */
export type UsageFeature = "ai" | "photoreal";

export const USAGE_FEATURES = ["ai", "photoreal"] as const satisfies readonly UsageFeature[];

export type Cost = Readonly<{ feature: UsageFeature; microdollars: number }>;

export const MICRODOLLARS_PER_DOLLAR = 1_000_000;

export const microdollars = (dollars: number): number =>
  Math.round(dollars * MICRODOLLARS_PER_DOLLAR);

/** Allowances a calendar month (UTC), in microdollars. A limit stored in the database replaces these. */
export type Allowances = Readonly<{
  user: Readonly<Record<UsageFeature, number>>;
  brand: Readonly<Record<UsageFeature, number>>;
  /** Across every user and both features, for each UTC day. */
  globalCeiling: number;
}>;

export type UsageConfig = Readonly<{
  USAGE_USER_MONTHLY_AI: number;
  USAGE_BRAND_MONTHLY_AI: number;
  USAGE_USER_MONTHLY_PHOTOREAL: number;
  USAGE_BRAND_MONTHLY_PHOTOREAL: number;
  USAGE_GLOBAL_DAILY_CEILING: number;
}>;

export const allowancesFrom = (config: UsageConfig): Allowances => ({
  user: { ai: config.USAGE_USER_MONTHLY_AI, photoreal: config.USAGE_USER_MONTHLY_PHOTOREAL },
  brand: { ai: config.USAGE_BRAND_MONTHLY_AI, photoreal: config.USAGE_BRAND_MONTHLY_PHOTOREAL },
  globalCeiling: config.USAGE_GLOBAL_DAILY_CEILING,
});
