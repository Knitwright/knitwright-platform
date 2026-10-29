/**
 * The rulebook entry behind every check (spec decision 11). Ids come from docs/spec/articles/JSY-SS-01/rulebook.md
 * until the rulebook table (plan v5 X2) holds them. A check with no fitting entry yet uses `R-GAP-000`; those codes
 * are listed in `GAP_CODES` so the rulebook authors know what to write. The text of a rule is never invented here.
 */

export const RULE_GAP = "R-GAP-000";
export const RULE_ID_PATTERN = /^R-[A-Z]+-[0-9]{3}$/;

/** Codes made by the factory profile, the validation gate itself and the check modules. */
const CHECK_RULES: Readonly<Record<string, string>> = {
  "article-not-made": RULE_GAP,
  "moq-not-set": RULE_GAP,
  "lead-time-not-set": RULE_GAP,
  "price-ladder-not-set": "R-COST-002",
  "check-failed": RULE_GAP,
  // lib/guardrails, registered as modules (decision 0045).
  "seam-cross": "R-SUB-004",
  "min-dpi": "R-SUB-003",
  "bleed-short": "R-SUB-002",
  "safe-zone": "R-SUB-004",
  "gamut-approx": "R-SUB-005",
  // Base article and parameters. A parameter finding carries the rule of its own range when the catalogue gives one.
  "article-not-set": RULE_GAP,
  "article-not-offered": RULE_GAP,
  "parameter-unknown": RULE_GAP,
  "parameter-wrong-type": RULE_GAP,
  "parameter-out-of-range": RULE_GAP,
  "parameter-off-step": RULE_GAP,
  "parameter-not-offered": RULE_GAP,
  // Moderation (F-G1, F-G2 "moderation status clear").
  "moderation-pending": RULE_GAP,
  "moderation-flagged": RULE_GAP,
  "moderation-blocked": RULE_GAP,
};

/** Every line of the tech pack's "Ready for the factory" list (lib/techpack/production/readiness*.ts). */
const READINESS_RULES: Readonly<Record<string, string>> = {
  "components-filled": RULE_GAP,
  "components-no-proposals": RULE_GAP,
  "fabric-reduction": "R-SUB-006",
  "fabric-test": "R-SUB-006",
  "fabric-use-basis": RULE_GAP,
  "league-rules": "R-PER-002",
  "order-roster": "R-COST-003",
  "pattern-grain": RULE_GAP,
  "pattern-notches": "R-PAT-006",
  "pattern-present": RULE_GAP,
  "pattern-review": RULE_GAP,
  "pattern-seam-allowance": "R-PAT-001",
  "pattern-seams-agree": "R-PAT-007",
  "print-avoid-colours": RULE_GAP,
  "print-bleed": "R-SUB-002",
  "print-colour-codes": RULE_GAP,
  "print-files": RULE_GAP,
  "print-image-dpi": "R-SUB-003",
  "print-marks": "R-SUB-007",
  "print-picture-read": RULE_GAP,
  "print-profile": "R-SUB-003",
  "print-scale": "R-SUB-006",
  "proof-strike-off": "R-SUB-005",
  "release-frozen": RULE_GAP,
  "spec-in-tolerance": "R-FIT-008",
  "spec-measured": "R-FIT-008",
  "spec-targets": "R-FIT-008",
};

const READINESS_PREFIX = "readiness-";

/** Every code a check can produce today, with its rule. Readiness lines carry the `readiness-` prefix. */
export const ALL_RULES: Readonly<Record<string, string>> = {
  ...CHECK_RULES,
  ...Object.fromEntries(Object.entries(READINESS_RULES).map(([id, rule]) => [`${READINESS_PREFIX}${id}`, rule])),
};

/** The rule a finding code answers to. An unknown code is a gap, never a guess at a neighbour's rule. */
export function ruleIdFor(code: string): string {
  return ALL_RULES[code] ?? RULE_GAP;
}

/** The codes whose rulebook entry is still to be written, in one order. */
export const GAP_CODES: readonly string[] = Object.keys(ALL_RULES)
  .filter((code) => ALL_RULES[code] === RULE_GAP)
  .sort();
