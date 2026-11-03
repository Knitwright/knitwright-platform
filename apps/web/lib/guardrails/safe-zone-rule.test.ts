import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ruleIdFor } from "@/lib/validation/rules";
import { SAFE_ZONE_RULE } from "./safe-zone-rule";
import { DEFAULT_SETTINGS, sourceNote } from "./settings";

/**
 * THE FIGURE THIS CHECK USES COMES FROM THE RULE THIS CHECK CITES.
 *
 * It did not. `lib/validation/rules.ts` has cited `R-SUB-004` for the safe-zone check since decision 0045, and
 * `R-SUB-004` says critical elements keep 15 mm away from seams -- while the setting was a 10 mm Knitwright
 * default. Nothing was invented and nothing was hidden (the warning said "Knitwright default"), but a name
 * placed 12 mm from a seam drew no warning at all, so the platform stayed silent about a placement the rule in
 * its own citation rejects. Plan v5 collected it as owner question 93; the owner answered that the rule wins.
 *
 * These tests read the figure back out of the rulebook's own table, so the quotation in `safe-zone-rule.ts`
 * cannot drift from the row it quotes, and they tie the three together: the rule's text, the check's citation
 * and the setting the check runs on.
 */

const ROOT = join(__dirname, "..", "..", "..", "..");
const RULEBOOK = readFileSync(join(ROOT, "docs", "spec", "articles", "JSY-SS-01", "rulebook.md"), "utf8");

/** The one row of the rulebook table whose first column is this rule. */
const rowFor = (ruleId: string): string => {
  const row = RULEBOOK.split("\n").find((line) => line.startsWith(`| ${ruleId} |`));
  expect(row, `${ruleId} has a row in the rulebook`).toBeDefined();
  return row ?? "";
};

describe("the clear space around a name or a number", () => {
  it("is the figure R-SUB-004 states, read out of the rulebook itself", () => {
    expect(rowFor(SAFE_ZONE_RULE.ruleId)).toContain(`keep ${SAFE_ZONE_RULE.mm} mm away from seams`);
  });

  it("is the rule the safe-zone check cites, so the number and the citation agree", () => {
    expect(ruleIdFor("safe-zone")).toBe(SAFE_ZONE_RULE.ruleId);
    expect(DEFAULT_SETTINGS.safeZoneMm.value).toBe(SAFE_ZONE_RULE.mm);
  });

  it("says where it came from, and does not call a rule's figure a Knitwright default", () => {
    expect(DEFAULT_SETTINGS.safeZoneMm.source).toBe("rulebook");
    expect(sourceNote("rulebook")).toBe("from rule R-SUB-004");
    expect(sourceNote("rulebook")).not.toContain("Knitwright default");
  });

  it("still lets a print house's own figure win, which is what the setting is for", () => {
    expect(sourceNote("print-house")).toBe("from your print house");
    expect(sourceNote("knitwright-default")).toContain("Knitwright default");
  });
});
