import { GAP_RULE_ID } from "@/lib/rulebook/constants";

/**
 * WHY EVERY MARKETING RULE CARRIES `R-GAP-000` (spec decision 11; plan v5 L4, decision 0094).
 *
 * Every finding and every field of this workstream carries a `ruleId` of the form `R-<TOPIC>-<NNN>`
 * that resolves to a `rulebook_entry`. No entry covers marketing artwork: the rulebook of
 * `docs/spec/articles/JSY-SS-01/rulebook.md` is about making a garment, and its nearest entries
 * (`R-SUB-003`, 150 DPI at 1:1 in sRGB, and `R-SUB-008`, the factory's own rich black) are about the
 * print file a factory's RIP reads, not about a poster or a story. Nothing here invents a rule's
 * words, so every rule id in this directory is the gap id, and each gap is listed below and on the
 * pull request.
 */
export const MARKETING_RULE = GAP_RULE_ID;

/** One thing nobody has written a rule for yet, in the words the pull request lists it by. */
export interface MarketingGap {
  readonly ruleId: string;
  readonly about: string;
}

const gap = (about: string): MarketingGap => ({ ruleId: MARKETING_RULE, about });

/**
 * The gaps this workstream leaves open. Each is a decision somebody has to make: the plan says a
 * check with no entry uses `R-GAP-000` and is listed, so the list is data rather than prose in a
 * file nobody reads.
 */
export const MARKETING_GAPS: readonly MarketingGap[] = [
  gap("What a marketing layout's slots may be: how many mockups, how much text, and where each sits."),
  gap("How long each text field may be. The character limits are Knitwright's own, not reviewed by anyone."),
  gap("Which destination a marketing template belongs in, and at what size and resolution."),
  gap("What resolution a marketing export may be asked for, beyond the spec's 72 and 300."),
  gap("Which colour profile a CMYK export is separated against. None is on file, so CMYK is refused."),
  gap("Which exports carry the watermark, and what unlocks them."),
  gap("What a run of 'Write for me' costs, in credits as well as in model spend."),
];
