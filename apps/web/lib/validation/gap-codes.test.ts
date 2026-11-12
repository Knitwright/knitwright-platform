import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MODERATION_RESULTS } from "./ports";
import { ALL_RULES, GAP_CODES } from "./rules";

/**
 * THE GUARD ON R-GAP-000 (plan v6 D1, decision 0132; spec decision 11, "every rule explains itself").
 *
 * A check with no rulebook entry yet answers to `R-GAP-000`, and the plan's rule is that every such code is listed
 * by name -- in the PR that adds it and here -- so the rulebook's authors know what to write. Two ways a code
 * could slip past that:
 *
 *   1. A new code is mapped to the gap in `rules.ts` without anyone saying so. The list below is the explicit
 *      listing: `GAP_CODES` must equal it, so adding a gap code, or giving one a rule, fails until this list is
 *      changed in the same PR.
 *   2. A new code is produced by a check and never entered in `rules.ts` at all. `ruleIdFor` would quietly answer
 *      `R-GAP-000` for it. The second test reads every finding code the check sources write and requires each to
 *      have an entry, gap or not.
 *
 * The text of a rule is never written here: an entry is a rulebook id or the gap, nothing else.
 */

/** The codes that answer to R-GAP-000 today, in `GAP_CODES` order. Change this only with the PR listing them. */
const R_GAP_000_CODES: readonly string[] = [
  "article-not-made",
  "article-not-offered",
  "article-not-set",
  "check-failed",
  "lead-time-not-set",
  "moderation-blocked",
  "moderation-flagged",
  "moderation-pending",
  "moq-not-set",
  "parameter-not-offered",
  "parameter-off-step",
  "parameter-out-of-range",
  "parameter-unknown",
  "parameter-wrong-type",
  "readiness-components-filled",
  "readiness-components-no-proposals",
  "readiness-fabric-use-basis",
  "readiness-pattern-grain",
  "readiness-pattern-present",
  "readiness-pattern-review",
  "readiness-print-avoid-colours",
  "readiness-print-colour-codes",
  "readiness-print-files",
  "readiness-print-picture-read",
  "readiness-release-frozen",
  "repeat-layer-outside-tile",
  "repeat-no-layers",
  "repeat-no-name",
  "repeat-tile-out-of-range",
];

const ROOT = join(__dirname, "..", "..");

/** Every non-test source file of the directories whose checks become validation findings. */
const SOURCES: readonly string[] = ["lib/validation", "lib/guardrails", "lib/repeat"].flatMap((dir) =>
  readdirSync(join(ROOT, dir), { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.ts$/.test(entry.name) && !/\.test\./.test(entry.name) && !entry.parentPath.includes("fixtures"))
    .map((entry) => join(entry.parentPath, entry.name)),
);

/** The codes a source writes as `code: "..."`, or hands to the parameter check's `blocker(design, "...")`. */
const writtenCodes = (): readonly string[] => {
  const found = new Set<string>();
  for (const path of SOURCES) {
    const text = readFileSync(path, "utf8");
    for (const match of text.matchAll(/\bcode: "([a-z0-9]+(?:-[a-z0-9]+)+)"|\bblocker\(design, "([a-z0-9]+(?:-[a-z0-9]+)+)"/g)) found.add(match[1] ?? match[2] ?? "");
  }
  return [...found].sort();
};

/** `moderation-<result>` is built from the result, so it is listed from the results rather than read from text. */
const moderationCodes = MODERATION_RESULTS.filter((result) => result !== "clear").map((result) => `moderation-${result}`);

describe("the codes that answer to R-GAP-000", () => {
  it("are exactly the explicit listing, so none is added or removed without being named", () => {
    expect(GAP_CODES).toEqual(R_GAP_000_CODES);
  });

  it("are named in the PR: 29 today", () => {
    expect(R_GAP_000_CODES).toHaveLength(29);
  });
});

describe("every code a check writes", () => {
  it("reads the check sources", () => {
    expect(SOURCES.length).toBeGreaterThan(10);
    expect(writtenCodes().length).toBeGreaterThan(15);
  });

  it("has an entry in rules.ts, a rule or the gap, and never falls through to the gap unlisted", () => {
    const missing = [...writtenCodes(), ...moderationCodes].filter((code) => !(code in ALL_RULES));
    expect(missing).toEqual([]);
  });
});
