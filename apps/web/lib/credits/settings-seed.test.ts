import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { OUTPUT_KINDS } from "./kinds";
import { CREDIT_SETTINGS } from "./settings";

const sql = readFileSync(resolve(__dirname, "../../../../supabase/migrations/20261025060000_credits.sql"), "utf8");

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
