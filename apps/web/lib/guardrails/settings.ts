import { DEFAULT_LABEL } from "@/lib/production/contract";
import { SAFE_ZONE_RULE } from "./safe-zone-rule";
import type { GuardrailSettings, Setting } from "./types";

/**
 * Settings the checks need to run. None is a measurement, and each is labelled with where it came from
 * (owner questions: print house dpi and bleed, league rules).
 *
 * **The clear space comes from the rulebook, not from us.** `R-SUB-004` says critical elements keep 15 mm away
 * from seams, and `lib/validation/rules.ts` already cites that rule for this check — while the figure here was a
 * 10 mm Knitwright default. So a name placed 12 mm from a seam drew no warning at all, and the platform was
 * silent about a placement the rule it names rejects. The owner answered it: the rule's figure wins. A league
 * or a print house that wants another number still sets `guardrails.safe_zone_mm`, which is what the setting is
 * for; what is gone is the platform quietly disagreeing with the rule in its own citation.
 */
export const DEFAULT_SETTINGS: GuardrailSettings = {
  minDpi: { value: 150, source: "knitwright-default" },
  bleedMm: { value: 10, source: "knitwright-default" },
  safeZoneMm: { value: SAFE_ZONE_RULE.mm, source: "rulebook" },
};

export const sourceNote = (source: Setting<unknown>["source"]): string => {
  if (source === "print-house") return "from your print house";
  return source === "rulebook" ? `from rule ${SAFE_ZONE_RULE.ruleId}` : DEFAULT_LABEL;
};
