import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fullDesign, packFor } from "@/lib/techpack/fixtures/designs";
import { completeProduction } from "@/lib/techpack/fixtures/production";
import { start } from "@/lib/garment/fixtures/specs";
import { ALL_RULES, GAP_CODES, RULE_GAP, RULE_ID_PATTERN, ruleIdFor } from "./rules";

/**
 * Spec decision 11: every finding carries a rule id that resolves to a rulebook entry. These tests enumerate every
 * code the checks can produce and prove each one is listed, and that every id names a rule the rulebook really holds
 * (docs/spec/articles/JSY-SS-01/rulebook.md) or is the gap id.
 */

const rulebook = readFileSync(new URL("../../../../docs/spec/articles/JSY-SS-01/rulebook.md", import.meta.url), "utf8");

/** Every rule id the rulebook file defines, read from the first cell of its tables. */
const RULEBOOK_IDS: ReadonlySet<string> = new Set(rulebook.split("\n").flatMap((line) => /^\|\s*(R-[A-Z]+-[0-9]{3})\s*\|/.exec(line)?.slice(1, 2) ?? []));

/** The readiness line ids the real tech pack produces, for a design with nothing filled in and for a full one. */
function readinessIds(): readonly string[] {
  const packs = [packFor(start("crew-tee")), packFor(fullDesign("team-jersey"), { production: completeProduction() })];
  return [...new Set(packs.flatMap((pack) => pack.readiness.groups.flatMap((group) => group.items.map((item) => item.id))))].sort();
}

describe("the rulebook ids this code uses", () => {
  it("reads the 45 rules of the worked article", () => {
    expect(RULEBOOK_IDS.size).toBe(45);
  });

  it("are each either a rule the rulebook holds or the gap id, never an invented one", () => {
    const unknown = Object.entries(ALL_RULES).filter(([, rule]) => rule !== RULE_GAP && !RULEBOOK_IDS.has(rule));
    expect(unknown).toEqual([]);
  });

  it("are each in the format a rulebook entry has", () => {
    expect(Object.values(ALL_RULES).every((rule) => RULE_ID_PATTERN.test(rule))).toBe(true);
    expect(RULE_ID_PATTERN.test(RULE_GAP)).toBe(true);
  });
});

describe("every code a check can produce", () => {
  it("covers every readiness line the tech pack really produces", () => {
    const ids = readinessIds();
    expect(ids.length).toBeGreaterThan(20);
    expect(ids.filter((id) => !(`readiness-${id}` in ALL_RULES))).toEqual([]);
  });

  it("resolves to a rule, and an unknown code is a gap rather than a neighbour's rule", () => {
    expect(ruleIdFor("readiness-print-bleed")).toBe("R-SUB-002");
    expect(ruleIdFor("seam-cross")).toBe("R-SUB-004");
    expect(ruleIdFor("not-a-code-anyone-wrote")).toBe(RULE_GAP);
  });

  it("lists the codes still waiting for a rulebook entry, in one order, so the PR can name them", () => {
    expect(GAP_CODES).toEqual([...GAP_CODES].sort());
    expect(GAP_CODES.length).toBeGreaterThan(0);
    expect(GAP_CODES.every((code) => ALL_RULES[code] === RULE_GAP)).toBe(true);
    expect(GAP_CODES).toContain("moderation-blocked");
  });
});
