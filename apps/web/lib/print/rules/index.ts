import { z } from "zod";
import { printRuleSetSchema, type PrintRuleSet } from "@/lib/production/contract";

/** The rules a brand has set: nothing. Shipped empty (open items P5, P7); a rule is added with the source it came from. */
export const EMPTY_RULES: PrintRuleSet = Object.freeze({
  minTextHeightMm: null,
  minLineMm: null,
  coloursToAvoid: [],
  numberRules: null,
});

export const EMPTY_RULES_SENTENCE = "No league rules set: check with the competition. The avoid list is empty.";

export const rulesAreEmpty = (rules: PrintRuleSet): boolean =>
  rules.minTextHeightMm === null && rules.minLineMm === null && rules.coloursToAvoid.length === 0 && rules.numberRules === null;

/** A league's or competition's rules for the kit, with where they were read. Structure only: none ships. */
export const leagueRuleSetSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(64),
  name: z.string().min(1).max(120),
  source: z.string().min(1, "Say where these rules were read.").max(300),
  rules: printRuleSetSchema,
});
export type LeagueRuleSet = z.output<typeof leagueRuleSetSchema>;

export const SHIPPED_LEAGUE_RULE_SETS: readonly LeagueRuleSet[] = Object.freeze([]);

const mm = (value: number): string => `${Number(value.toFixed(2))} mm`;

export function textHeightProblem(heightMm: number, rules: PrintRuleSet): string | null {
  const min = rules.minTextHeightMm;
  return min !== null && heightMm < min ? `This text is ${mm(heightMm)} tall. The print profile asks for at least ${mm(min)}.` : null;
}

export function colourProblem(hex: string, rules: PrintRuleSet): string | null {
  return rules.coloursToAvoid.includes(hex.toLowerCase()) ? `Colour ${hex.toLowerCase()} is on the list of colours that sublimates badly.` : null;
}

export function numberProblems(number: string, heightMm: number, rules: PrintRuleSet): string[] {
  const league = rules.numberRules;
  if (league === null) return [];
  const found: string[] = [];
  if (heightMm < league.minHeightMm || heightMm > league.maxHeightMm) {
    found.push(`A number must be ${league.minHeightMm} to ${league.maxHeightMm} mm tall (${league.source}). This one is ${mm(heightMm)}.`);
  }
  if (league.allowedDigits !== null) {
    const bad = [...number].find((digit) => !league.allowedDigits!.includes(digit));
    if (bad !== undefined) found.push(`The digit ${bad} is not allowed (${league.source}).`);
  }
  return found;
}
