/**
 * The clear space a rule of the rulebook states, and the rule that states it.
 *
 * `R-SUB-004`: "Artwork that crosses a seam can be offset by up to 3 mm after sewing; critical elements keep
 * 15 mm away from seams" -- and it names "crests, numbers and text" as the critical ones, which is exactly what
 * `safe-zone.ts` checks. The figure lives here rather than inside `DEFAULT_SETTINGS` so that the one place it is
 * written also names where it is written down, and `settings.test.ts` reads it back out of the rulebook's own
 * table so this file cannot drift from the rule.
 *
 * It is not a constant standing in for data: the rulebook is the data, this is a quotation of one row of it, and
 * the test fails if the quotation stops matching. A brand or a league that wants another number sets
 * `guardrails.safe_zone_mm` (`lib/settings/registry.ts`), which is what overrides it.
 */
export const SAFE_ZONE_RULE = { ruleId: "R-SUB-004", mm: 15 } as const;
