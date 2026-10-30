import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { OUTPUT_KINDS } from "./kinds";
import { CREDIT_SETTINGS } from "./settings";

/**
 * Every migration that seeds a credit_prices row. The credits migration seeded the first three
 * kinds; plan v5 X5b's package_exports migration adds `production_package` (decision 0070), so the
 * seed is read across both files.
 */
const MIGRATIONS = ["20261025060000_credits.sql", "20261101040000_package_exports.sql"];

const sql = MIGRATIONS.map((name) => readFileSync(resolve(__dirname, "../../../../supabase/migrations", name), "utf8")).join("\n");

describe("the credit_prices seed in the migration", () => {
  it("matches lib/credits/settings.ts, so there is one source for the numbers", () => {
    const seeded = new Map<string, number>();
    for (const [, kind, credits] of sql.matchAll(/\('(\w+)',\s*(\d+),\s*true\)/g).map((m) => [m[0], m[1], m[2]] as const)) {
      seeded.set(kind ?? "", Number(credits));
    }
    expect([...seeded.keys()].sort()).toEqual([...OUTPUT_KINDS].sort());
    for (const kind of OUTPUT_KINDS) expect(seeded.get(kind)).toBe(CREDIT_SETTINGS.prices[kind]);
  });

  it("seeds every price as a placeholder", () => {
    expect(sql).not.toMatch(/\('\w+',\s*\d+,\s*false\)/);
  });
});
